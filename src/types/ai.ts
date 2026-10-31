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

export interface ProposedChange {
  id: string;
  section: 'budget' | 'guest' | 'timeline' | 'task' | 'schedule' | 'vendor' | 'details';
  title: string;
  description: string;
  beforeValue?: any;
  afterValue: any;
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
