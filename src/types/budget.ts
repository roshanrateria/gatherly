export type PriorityTier = 'must_have' | 'high' | 'medium' | 'flexible';
export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'partially_paid' | 'paid_in_full';

export interface BudgetCategory {
  id: string;
  name: string;
  allocationPercent: number; // Percentage (e.g. 35)
  allocatedAmount: number; // Calculated or overridden
  priority: PriorityTier;
  description: string;
  isCustom?: boolean;
}

export interface Expense {
  id: string;
  categoryId: string;
  title: string;
  estimatedCost: number;
  actualCost: number;
  paidAmount: number;
  vendorId?: string;
  dueDate?: string;
  paymentStatus: PaymentStatus;
  notes?: string;
}

export interface BudgetSummary {
  totalBudget: number;
  totalAllocated: number;
  unallocated: number;
  totalEstimated: number;
  totalActual: number;
  totalPaid: number;
  pendingPayment: number;
  remainingBalance: number; // totalBudget - totalActual
  variance: number; // totalBudget - totalEstimated
  isOverrun: boolean;
  overrunAmount: number;
  perGuestEstimated: number;
  perGuestActual: number;
  utilizationPercent: number;
}

export interface BudgetScenario {
  id: string;
  name: string;
  description: string;
  multiplier: number; // e.g. 0.85 for lean, 1.0 for base, 1.25 for premium
  categoryAdjustments: Record<string, number>; // categoryId -> allocatedAmount
}
