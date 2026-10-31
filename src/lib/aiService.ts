import { AIConfig, StructuredAIResponse } from '../types/ai';
import { AppState } from '../types/index';
import { runOfflinePlanner } from './offlinePlanner';

/**
 * Universal Interchangeable AI Service.
 * Connects to live LLM providers (OpenAI, Anthropic, Gemini, Groq)
 * when configured with valid keys, or cleanly runs in high-precision Offline Mode.
 * Fully discloses external transmission and strictly validates structured JSON outputs.
 */
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
4. If photography becomes higher priority than decor: propose concrete budget shift to photography.
5. NEVER claim a vendor is booked, contract signed, or external payment processed unless it actually happened.
6. Provide proposed_changes with realistic diffs whenever an edit to guests, budget, or timeline is warranted.
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

      const res = await fetch(endpoint, {
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

      if (!res.ok) {
        throw new Error(`API error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content;
      if (rawText) {
        parsedResponse = JSON.parse(rawText);
      }
    } else if (config.provider === 'anthropic') {
      const endpoint = config.baseUrl || 'https://api.anthropic.com/v1/messages';
      const model = config.model || 'claude-3-5-sonnet-20241022';

      const res = await fetch(endpoint, {
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

      if (!res.ok) {
        throw new Error(`Anthropic error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const rawText = data.content?.[0]?.text;
      if (rawText) {
        // extract json from text if wrapped
        const clean = rawText.replace(/```json\n?|\n?```/g, '').trim();
        parsedResponse = JSON.parse(clean);
      }
    } else if (config.provider === 'gemini') {
      const model = config.model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey.trim()}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessageContent}` }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (!res.ok) {
        throw new Error(`Gemini error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        parsedResponse = JSON.parse(rawText);
      }
    }

    // Validate structured response has necessary fields
    if (
      parsedResponse &&
      typeof parsedResponse.message === 'string' &&
      Array.isArray(parsedResponse.recommendations)
    ) {
      // Ensure missing arrays are initialized
      parsedResponse.assumptions = parsedResponse.assumptions || [];
      parsedResponse.clarifying_questions = parsedResponse.clarifying_questions || [];
      parsedResponse.proposed_changes = parsedResponse.proposed_changes || [];
      parsedResponse.affected_sections = parsedResponse.affected_sections || [];
      parsedResponse.risks = parsedResponse.risks || [];
      parsedResponse.next_steps = parsedResponse.next_steps || [];

      return {
        response: parsedResponse,
        modeUsed: 'live',
        providerName: `${config.provider.toUpperCase()} (${config.model || 'live'})`,
      };
    }

    throw new Error('Malformed AI response schema from provider');
  } catch (err: any) {
    console.warn('Live AI provider failed or was unreachable, seamlessly falling back to high-precision Offline Mode:', err);
    // Graceful fallback to deterministic offline planner with error notification
    const fallback = runOfflinePlanner(userPrompt, state);
    fallback.message = `[Offline Mode Active - Live AI was unavailable: ${err?.message || 'Check key & connection'}]\n\n${fallback.message}`;
    return {
      response: fallback,
      modeUsed: 'offline',
      providerName: 'Offline Expert Fallback',
    };
  }
}
