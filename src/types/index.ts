import { EventDetails } from './event';
import { BudgetCategory, Expense, BudgetScenario } from './budget';
import { Milestone, Task } from './timeline';
import { Vendor } from './vendor';
import { Guest } from './guest';
import { ScheduleItem } from './schedule';
import { Idea } from './idea';
import { ChatMessage, ProposedChange, AIConfig } from './ai';

export * from './currency';
export * from './event';
export * from './budget';
export * from './timeline';
export * from './vendor';
export * from './guest';
export * from './schedule';
export * from './idea';
export * from './ai';

export interface AppState {
  event: EventDetails;
  categories: BudgetCategory[];
  expenses: Expense[];
  scenarios: BudgetScenario[];
  milestones: Milestone[];
  tasks: Task[];
  vendors: Vendor[];
  guests: Guest[];
  schedule: ScheduleItem[];
  ideas: Idea[];
  chatHistory: ChatMessage[];
  proposalsHistory: ProposedChange[];
  aiConfig: AIConfig;
}
