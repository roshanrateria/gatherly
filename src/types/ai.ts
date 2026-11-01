export type AIProviderType = 'offline' | 'openai' | 'anthropic' | 'gemini' | 'groq';

export interface AIConfig {
  provider: AIProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string;
  discloseDataSharing: boolean;
}

export interface RiskItem {
  severity: 'low' | 'medium' | 'high';
  issue: string;
  mitigation: string;
}

/**
 * Payload attached to a proposed change. Kept to a small, closed set so that
 * untrusted model output can be validated structurally before it is ever
 * applied to the event state:
 * - `budget` proposals carry a plain object of allocation keys -> numbers.
 * - `guest` proposals carry the new headcount as a number.
 * - Everything else is informational strings/numbers.
 */
export type ProposalPayload = number | string | Record<string, number>;

/** Keys that a live AI is allowed to set inside a budget proposal. */
export type BudgetAllocationKey = 'decorAllocated' | 'cateringAllocated' | 'photoAllocated';

export interface ProposedChange {
  id: string;
  section: 'budget' | 'guest' | 'timeline' | 'task' | 'schedule' | 'vendor' | 'details';
  title: string;
  description: string;
  beforeValue?: ProposalPayload;
  /**
   * Optional to match reality: AI payloads and hand-crafted proposals may omit
   * the delta. The apply engine (proposals.ts) already rejects changes whose
   * afterValue is unusable, so an absent delta never enters state.
   */
  afterValue?: ProposalPayload;
  applied: boolean;
  timestamp: string;
}

export interface StructuredAIResponse {
  message: string;
  reasoning_summary: string;
  assumptions: string[];
  clarifying_questions: string[];
  recommendations: string[];
  proposed_changes: ProposedChange[];
  affected_sections: string[];
  risks: RiskItem[];
  next_steps: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  structuredResponse?: StructuredAIResponse;
  appliedChanges?: string[];
}
