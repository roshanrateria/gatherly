import { AIConfig, StructuredAIResponse } from '../types/ai';
import { AppState } from '../types/index';
import { runOfflinePlanner } from './offlinePlanner';
import { sanitizeAIResponse } from './aiValidation';

/**
 * Universal Interchangeable AI Service.
 * Connects to live LLM providers (OpenAI, Anthropic, Gemini, Groq)
 * when configured with valid keys, or cleanly runs in high-precision Offline Mode.
 * Fully discloses external transmission and strictly validates structured JSON outputs.
 */

const REQUEST_TIMEOUT_MS = 30_000;

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Ensures the model's JSON is clean even if fenced in markdown code blocks. */
function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (fenced ? fenced[1] : trimmed).trim();
}

function parseJsonLoose(text: string): unknown {
  const cleaned = stripJsonFences(text);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Response did not contain a JSON object');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Extracts a human-readable message from an unknown thrown value. */
export function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Request timed out';
  }
  if (err instanceof RangeError) return 'Request aborted (timeout)';
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return 'Unknown error';
}

function requireOk(res: Response, providerLabel: string): void {
  if (!res.ok) {
    throw new Error(`${providerLabel} error ${res.status}: ${res.statusText}`);
  }
}

export async function generateAIPlanResponse(
  userPrompt: string,
  state: AppState,
  config: AIConfig
): Promise<{ response: StructuredAIResponse; modeUsed: 'offline' | 'live'; providerName: string }> {
  // If provider is set to offline or API key is missing, use deterministic Offline Planner
  if (config.provider === 'offline' || !config.apiKey || config.apiKey.trim() === '') {
    const offlineResult = runOfflinePlanner(userPrompt, state);
    return {
      response: offlineResult,
      modeUsed: 'offline',
      providerName: 'Deterministic Expert System (Offline Mode)',
    };
  }

  // Attempt live LLM execution
  try {
    const systemPrompt = `You are Gatherly AI, a world-class celebration & event planner, budget adviser, and logistics coordinator.
Your task is to analyze the user's event context and request, and output a STRICT JSON object conforming EXACTLY to the following schema:
{
  "message": "string - comprehensive, warm, highly practical event planning reply",
  "reasoning_summary": "string - concise explanation of recommendations and trade-off logic",
  "assumptions": ["string - key assumptions made"],
  "clarifying_questions": ["string - essential follow-up questions if needed"],
  "recommendations": ["string - actionable specific suggestions"],
  "proposed_changes": [
    {
      "id": "prop_unique_id",
      "section": "budget" | "guest" | "timeline" | "task" | "schedule" | "vendor" | "details",
      "title": "Clear action title (e.g., Update guest count to 150)",
      "description": "Explanation of changes and trade-offs",
      "beforeValue": null,
      "afterValue": null,
      "applied": false,
      "timestamp": "ISO timestamp"
    }
  ],
  "affected_sections": ["string - names of modules affected"],
  "risks": [
    {
      "severity": "low" | "medium" | "high",
      "issue": "Specific risk description",
      "mitigation": "Concrete action to mitigate"
    }
  ],
  "next_steps": ["string - next recommended steps for the host"]
}

STRICT DECISION RULES:
1. All budget numbers must be realistic and respectful of priorities.
2. Distinguish explicit requirements (must-haves) from preferences (nice-to-haves).
3. If guest count increases with fixed budget: calculate per-guest drop, identify pressure points, propose trade-offs (e.g. trim flexible decor or favors to protect catering).
4. If photography becomes higher priority than decor: propose concrete budget shift to photography (afterValue: {"decorAllocated": NewDecorNumber, "photoAllocated": NewPhotoNumber}).
5. For guest-count changes use afterValue as the plain number of guests.
6. NEVER claim a vendor is booked, contract signed, or external payment processed unless it actually happened.
7. Return ONLY valid JSON, no markdown codeblocks, no commentary outside JSON.`;

    const eventContext = {
      title: state.event.title,
      type: state.event.type,
      startDate: state.event.startDate,
      durationDays: state.event.durationDays,
      location: state.event.location,
      guestCount: state.event.guests.count,
      budget: state.event.budget,
      priorities: state.event.priorities,
      categoriesCount: state.categories.length,
      categories: state.categories.map(c => ({ name: c.name, allocated: c.allocatedAmount, priority: c.priority })),
      expensesCount: state.expenses.length,
      milestonesCount: state.milestones.length,
    };

    const userMessageContent = `Event Context: ${JSON.stringify(eventContext)}\n\nUser Request: ${userPrompt}`;

    let parsedResponse: StructuredAIResponse | null = null;

    if (config.provider === 'openai' || config.provider === 'groq') {
      const endpoint = config.provider === 'groq'
        ? (config.baseUrl || 'https://api.groq.com/openai/v1/chat/completions')
        : (config.baseUrl || 'https://api.openai.com/v1/chat/completions');

      const model = config.model || (config.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');

      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessageContent },
          ],
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });

      requireOk(res, 'API');
      const data: unknown = await res.json();
      const rawText = (data as { choices?: { message?: { content?: unknown } }[] })
        ?.choices?.[0]?.message?.content;
      if (typeof rawText === 'string' && rawText.trim()) {
        parsedResponse = sanitizeAIResponse(parseJsonLoose(rawText));
      }
    } else if (config.provider === 'anthropic') {
      const endpoint = config.baseUrl || 'https://api.anthropic.com/v1/messages';
      const model = config.model || 'claude-3-5-sonnet-20241022';

      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 3000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessageContent }],
        }),
      });

      requireOk(res, 'Anthropic');
      const data: unknown = await res.json();
      const rawText = (data as { content?: { text?: unknown }[] })?.content?.[0]?.text;
      if (typeof rawText === 'string' && rawText.trim()) {
        parsedResponse = sanitizeAIResponse(parseJsonLoose(rawText));
      }
    } else if (config.provider === 'gemini') {
      const model = config.model || 'gemini-1.5-flash';
      // The API key travels in a header, never in the URL query string,
      // so it cannot leak into proxies, logs, or browser history entries.
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey.trim(),
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessageContent}` }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      requireOk(res, 'Gemini');
      const data: unknown = await res.json();
      const rawText = (data as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })
        ?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof rawText === 'string' && rawText.trim()) {
        parsedResponse = sanitizeAIResponse(parseJsonLoose(rawText));
      }
    }

    if (parsedResponse) {
      return {
        response: parsedResponse,
        modeUsed: 'live',
        providerName: `${config.provider.toUpperCase()} (${config.model || 'live'})`,
      };
    }

    throw new Error('Malformed AI response schema from provider');
  } catch (err: unknown) {
    const detail = describeError(err);
    console.warn('Live AI provider failed or was unreachable, seamlessly falling back to high-precision Offline Mode:', err);
    // Graceful fallback to deterministic offline planner with error notification
    const fallback = runOfflinePlanner(userPrompt, state);
    fallback.message = `[Offline Mode Active - Live AI was unavailable: ${detail}]\n\n${fallback.message}`;
    return {
      response: fallback,
      modeUsed: 'offline',
      providerName: 'Offline Expert Fallback',
    };
  }
}
