import { AppState, BudgetCategory, ProposedChange } from '../types/index';
import { BudgetAllocationKey } from '../types/ai';
import { BUDGET_ALLOCATION_KEYS, clampBudgetAmount, clampGuestCount } from './aiValidation';
import { fallbackExpectedAttendance } from './guestMetrics';

/**
 * The single proposal-apply engine used by Dashboard.tsx and AIPlannerTab so
 * that applying one proposal or everything at once follows exactly the same
 * validation path (previously both components carried divergent copies of the
 * logic that read stale state and crashed on malformed payloads).
 */

const MAX_MONEY = 1_000_000_000_000;
const INVALID_STATE_ERROR = 'Invalid application state';

export interface ProposalSkip {
  id: string;
  title: string;
  reason: string;
}

export interface ProposalApplyResult {
  /** New state with every applicable proposal applied (event.updatedAt bumped). */
  state: AppState;
  /** The proposals that were applied, stamped `applied: true`. */
  applied: ProposedChange[];
  /** Proposals rejected, with a user-facing reason. */
  skipped: ProposalSkip[];
}

/** Sections the engine can apply automatically today. */
export function isApplicableSection(section: ProposedChange['section']): boolean {
  return section === 'guest' || section === 'budget';
}

function findCategoryByAllocationKey(
  state: AppState,
  key: BudgetAllocationKey
): BudgetCategory | undefined {
  const name = (candidate: BudgetCategory): string => candidate.name.toLowerCase();
  switch (key) {
    case 'decorAllocated':
      return state.categories.find(c => name(c).includes('decor') || name(c).includes('floral'));
    case 'cateringAllocated':
      return state.categories.find(c => name(c).includes('cater') || name(c).includes('food'));
    case 'photoAllocated':
      return state.categories.find(c => name(c).includes('photo'));
    default:
      return undefined;
  }
}

function readMoneyMap(
  payload: ProposalValue
): Partial<Record<BudgetAllocationKey, number>> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return {};
  const source = payload as Record<string, unknown>;
  const out: Partial<Record<BudgetAllocationKey, number>> = {};
  for (const key of BUDGET_ALLOCATION_KEYS) {
    const raw = source[key];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= MAX_MONEY) {
      out[key] = Math.round(raw);
    }
  }
  return out;
}

type ProposalValue = ProposedChange['afterValue'];

interface SingleOutcome {
  state: AppState;
  ok: boolean;
  reason?: string;
}

function applyOne(state: AppState, proposal: ProposedChange): SingleOutcome {
  if (!proposal.id || proposal.applied) {
    return { state, ok: false, reason: 'Already applied' };
  }

  const afterValue = proposal.afterValue;
  if (afterValue === undefined) {
    return { state, ok: false, reason: 'No target value in this proposal' };
  }

  if (proposal.section === 'guest') {
    if (typeof afterValue !== 'number' || !Number.isFinite(afterValue)) {
      return { state, ok: false, reason: 'Guest count must be a number' };
    }
    const count = clampGuestCount(afterValue);
    if (count < 1) {
      return { state, ok: false, reason: 'Guest count must be at least 1' };
    }
    return {
      ok: true,
      state: {
        ...state,
        event: {
          ...state.event,
          guests: {
            ...state.event.guests,
            count,
            expectedAttendance: fallbackExpectedAttendance(count),
          },
          updatedAt: new Date().toISOString(),
        },
      },
    };
  }

  if (proposal.section === 'budget') {
    const targets = readMoneyMap(afterValue);
    const keys = Object.keys(targets) as BudgetAllocationKey[];
    if (keys.length === 0) {
      return {
        state,
        ok: false,
        reason: 'Budget proposal must reference decor, catering, or photo allocations',
      };
    }
    const resolutions: Array<{ category: BudgetCategory; amount: number }> = [];
    for (const key of keys) {
      const category = findCategoryByAllocationKey(state, key);
      if (!category) {
        return { state, ok: false, reason: `No matching category for ${key}` };
      }
      resolutions.push({ category, amount: clampBudgetAmount(targets[key] as number) });
    }
    const categoryPatch = new Map<string, Partial<BudgetCategory>>();
    const budgetTotal = state.event.budget.total;
    resolutions.forEach(({ category, amount }) => {
      categoryPatch.set(category.id, {
        allocatedAmount: amount,
        allocationPercent: budgetTotal > 0 ? Math.round((amount / budgetTotal) * 100) : category.allocationPercent,
      });
    });
    return {
      ok: true,
      state: {
        ...state,
        categories: state.categories.map(cat =>
          categoryPatch.has(cat.id)
            ? { ...cat, ...categoryPatch.get(cat.id) }
            : cat
        ),
        event: { ...state.event, updatedAt: new Date().toISOString() },
      },
    };
  }

  // timeline/task/schedule/vendor/details proposals are advisory: they carry
  // narrative payloads we deliberately do not auto-apply.
  return {
    state,
    ok: false,
    reason: 'Advisory proposal — apply this suggestion manually in the relevant tab',
  };
}

/** Guards application only running against a minimally-shaped state object. */
function assertValidState(state: AppState): AppState {
  if (!state || typeof state !== 'object' || !Array.isArray(state.categories) || typeof state.event !== 'object') {
    throw new Error(INVALID_STATE_ERROR);
  }
  return state;
}

export function applyProposalsToState(
  state: AppState,
  proposals: ProposedChange[]
): ProposalApplyResult {
  const validState = assertValidState(state);
  const now = new Date().toISOString();

  const applied: ProposedChange[] = [];
  const skipped: ProposalSkip[] = [];
  let working = validState;

  for (const proposal of proposals) {
    if (!proposal) continue;
    try {
      const outcome = applyOne(working, proposal);
      working = outcome.state;
      if (outcome.ok) {
        applied.push({ ...proposal, applied: true, timestamp: now });
      } else {
        skipped.push({
          id: proposal.id || 'unknown',
          title: proposal.title,
          reason: outcome.reason || 'Could not be applied',
        });
      }
    } catch (err) {
      console.error('Proposal application failed:', proposal.id, err);
      skipped.push({
        id: proposal.id || 'unknown',
        title: proposal.title,
        reason: 'Internal error while applying this proposal',
      });
    }
  }

  return { state: working, applied, skipped };
}
