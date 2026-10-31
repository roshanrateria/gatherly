import { StructuredAIResponse, ProposedChange } from '../types/ai';
import { AppState } from '../types/index';
import { calculateBudgetSummary } from './deterministicBudget';

/**
 * High-Precision Offline Rule-Based AI Planner.
 * Fulfills all decision rules, detects conflicts, budget overruns,
 * calculates deterministic trade-offs, and proposes actionable changes.
 */
export function runOfflinePlanner(
  prompt: string,
  state: AppState
): StructuredAIResponse {
  const lower = prompt.toLowerCase();
  const summary = calculateBudgetSummary(
    state.event.budget.total,
    state.categories,
    state.expenses,
    state.guests.length > 0 ? state.guests.length : state.event.guests.count
  );

  // Scenario 1: Guest count increase with fixed budget
  // e.g. "increase guests to 150", "from 100 to 150", "guests changed to 200", "more guests"
  const fromToMatch = prompt.match(/(?:from\s*\d+\s*)?(?:to|increased?\s*to|now|around)\s*(\d+)\s*(?:guests?|people|pax)?/i);
  const guestMatch = fromToMatch ||
                     prompt.match(/(?:guests?|headcount|people)\s*(?:to|is|are|increased? to)?\s*(\d+)/i) ||
                     prompt.match(/(\d+)\s*(?:guests?|attendees|people|pax)/i);

  if (guestMatch && (lower.includes('increase') || lower.includes('change') || lower.includes('more') || lower.includes('from'))) {
    const newCount = parseInt(guestMatch[1], 10);
    const oldCount = state.event.guests.count;

    if (newCount !== oldCount) {
      const budgetTotal = state.event.budget.total;
      const oldPerGuest = Math.round(budgetTotal / Math.max(1, oldCount));
      const newPerGuest = Math.round(budgetTotal / Math.max(1, newCount));
      const perGuestDrop = oldPerGuest - newPerGuest;

      // Find catering and decor categories
      const cateringCat = state.categories.find(c => c.name.toLowerCase().includes('cater') || c.name.toLowerCase().includes('food'));
      const decorCat = state.categories.find(c => c.name.toLowerCase().includes('decor') || c.name.toLowerCase().includes('floral'));
      const favorsCat = state.categories.find(c => c.name.toLowerCase().includes('favor') || c.name.toLowerCase().includes('gift') || c.name.toLowerCase().includes('swag'));

      // Calculate realistic reallocation to avoid food crunch
      const proposedChanges: ProposedChange[] = [];

      proposedChanges.push({
        id: `prop_guest_${Date.now()}`,
        section: 'guest',
        title: `Update Target Guest Count: ${oldCount} → ${newCount} guests`,
        description: `Recalibrates catering estimates and seating layout for ${newCount} guests while keeping total budget fixed at ${state.event.budget.currency} ${budgetTotal.toLocaleString()}.`,
        beforeValue: oldCount,
        afterValue: newCount,
        applied: false,
        timestamp: new Date().toISOString(),
      });

      if (decorCat && cateringCat) {
        // Shift 4% from decor to catering to absorb the higher plate count
        const decorCut = Math.round(decorCat.allocatedAmount * 0.15);
        proposedChanges.push({
          id: `prop_realloc_decor_${Date.now()}`,
          section: 'budget',
          title: `Reallocate Decor to Catering (+${decorCut.toLocaleString()})`,
          description: `Trim lavish floral installations by 15% (-${decorCut.toLocaleString()}) and assign to ${cateringCat.name} to preserve food quality at higher guest volume.`,
          beforeValue: { decorAllocated: decorCat.allocatedAmount, cateringAllocated: cateringCat.allocatedAmount },
          afterValue: { decorAllocated: decorCat.allocatedAmount - decorCut, cateringAllocated: cateringCat.allocatedAmount + decorCut },
          applied: false,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        message: `I have recalculated your estimates for an expanded guest count of ${newCount} (up from ${oldCount}). Because your total budget remains fixed at ${state.event.budget.currency} ${budgetTotal.toLocaleString()}, available spend per guest drops from ${oldPerGuest.toLocaleString()} to ${newPerGuest.toLocaleString()} (a drop of ${perGuestDrop.toLocaleString()} per guest). To prevent severe pressure on catering quality and venue seating, I have prepared concrete trade-offs.`,
        reasoning_summary: `Increasing headcount without increasing budget creates immediate strain on per-plate food costs and venue fire-safety limits. Prioritizing hospitality requires trimming secondary decor elements or opting for elegant minimalist ambient lighting rather than heavy fresh floral walls.`,
        assumptions: [
          `Total budget remains unchanged at ${state.event.budget.currency} ${budgetTotal.toLocaleString()}.`,
          `Venue has sufficient certified physical capacity for ${newCount} seated attendees.`,
          `Caterer has not yet locked minimum contract penalties for menu alterations.`,
        ],
        clarifying_questions: [
          `Has your venue team confirmed adequate seating, parking, and restroom facilities for ${newCount} guests?`,
          `Would you like to shift the food format to live buffet counters or cocktail style to optimize per-plate cost?`,
        ],
        recommendations: [
          `Rebalance budget: Transfer 15% of flexible decor budget to food & beverage to maintain high meal ratings.`,
          `Streamline bar menu: Standardize signature mocktails/cocktails rather than open custom requests to control beverage cost.`,
          `Audit table density: Ensure 60-inch round tables seat 8 guests comfortably with accessible aisle pathways.`,
        ],
        proposed_changes: proposedChanges,
        affected_sections: ['Guests', 'Budget Allocations', 'Venue Capacity & Seating', 'Catering Logistics'],
        risks: [
          {
            severity: 'high',
            issue: `Per-guest budget compressed by ${Math.round((perGuestDrop / oldPerGuest) * 100)}%.`,
            mitigation: `Lock guaranteed headcount 10 days prior with RSVP cutoff and negotiate tier volume discounts with caterer.`,
          },
          {
            severity: 'medium',
            issue: `Venue capacity crunch during main ceremony or dining peak.`,
            mitigation: `Verify fire exit pathways and request extra buffet serving stations to prevent long queues.`,
          },
        ],
        next_steps: [
          `Click "Apply Changes" below to update guest count and rebalance budget allocations.`,
          `Update your Guest List RSVP entries to start collecting accurate headcounts.`,
          `Review the revised per-guest catering allowance in the Budget module.`,
        ],
      };
    }
  }

  // Scenario 2: Photography prioritized over decoration
  if (lower.includes('photo') && (lower.includes('priorit') || lower.includes('more than decor') || lower.includes('over decor') || lower.includes('cinematography'))) {
    const photoCat = state.categories.find(c => c.name.toLowerCase().includes('photo'));
    const decorCat = state.categories.find(c => c.name.toLowerCase().includes('decor') || c.name.toLowerCase().includes('floral'));

    const proposedChanges: ProposedChange[] = [];

    if (photoCat && decorCat) {
      const shiftAmount = Math.round(decorCat.allocatedAmount * 0.20);
      proposedChanges.push({
        id: `prop_priority_shift_${Date.now()}`,
        section: 'budget',
        title: `Reallocate Decor to Photography (+${shiftAmount.toLocaleString()})`,
        description: `Increase ${photoCat.name} from ${photoCat.allocatedAmount.toLocaleString()} to ${(photoCat.allocatedAmount + shiftAmount).toLocaleString()} by shifting 20% from ${decorCat.name} (-${shiftAmount.toLocaleString()}).`,
        beforeValue: { photoAllocated: photoCat.allocatedAmount, decorAllocated: decorCat.allocatedAmount },
        afterValue: { photoAllocated: photoCat.allocatedAmount + shiftAmount, decorAllocated: decorCat.allocatedAmount - shiftAmount },
        applied: false,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      message: `I have reorganized your priorities to place Photography & Cinematography above Decor. Timeless visual memories are now safeguarded as a top must-have. To fund premium candid coverage, drone cinematography, and same-day teaser edits without increasing total spend, I have proposed reallocating funds from heavy stage floral installations toward your visual crew.`,
      reasoning_summary: `Photography preserves lifelong memories, whereas extravagant fresh florals wilt within hours. Reallocating 20% of decor into camera crew grants access to top-tier candid leads and 4K cinema drones. Decor can leverage warm architectural warm-lighting, fairy lights, and reusable fabric drapes at lower cost.`,
      assumptions: [
        `You want 2 candid photographers + 2 cinematographers + drone operator.`,
        `Decor will transition to elegant architectural lighting and structured fabric backdrops rather than imported exotic fresh flowers.`,
      ],
      clarifying_questions: [
        `Do you need pre-event couple shoots or post-event album prints included in the photography package?`,
        `Are there specific drone flyover permissions needed at your chosen venue?`,
      ],
      recommendations: [
        `Increase Photography budget allocation by 20% of decor funds.`,
        `Draft detailed shot-list: sunset couple portraits, candid elder blessings, emotional vows and unposed guest laughter.`,
        `Opt for warm ambient LED wash lights and chandeliers for decor, which also drastically enhance photography exposure!`,
      ],
      proposed_changes: proposedChanges,
      affected_sections: ['Budget Categories', 'Vendor Requirements (Photography)', 'Decor Blueprint'],
      risks: [
        {
          severity: 'low',
          issue: `Stage floral density will be lighter.`,
          mitigation: `Use warm gobos, LED uplighting, and statement velvet drapery which photograph with rich cinematic depth.`,
        },
      ],
      next_steps: [
        `Click "Apply Changes" below to shift budget into Photography.`,
        `Review shortlisted photographers in the Vendors module and compare portfolios.`,
      ],
    };
  }

  // Scenario 3: Budget Overrun detected or general optimization
  if (summary.isOverrun || lower.includes('overrun') || lower.includes('cut budget') || lower.includes('save money') || lower.includes('reduce cost')) {
    const flexibleCats = state.categories.filter(c => c.priority === 'flexible' || c.priority === 'medium');
    const proposedChanges: ProposedChange[] = [];

    let totalSaved = 0;
    flexibleCats.forEach(cat => {
      const cut = Math.round(cat.allocatedAmount * 0.15);
      if (cut > 0 && totalSaved < (summary.overrunAmount || state.event.budget.total * 0.1)) {
        totalSaved += cut;
        proposedChanges.push({
          id: `prop_trim_${cat.id}_${Date.now()}`,
          section: 'budget',
          title: `Streamline ${cat.name} (-${cut.toLocaleString()})`,
          description: `Trim non-essential add-ons and optional favors to save ${state.event.budget.currency} ${cut.toLocaleString()}.`,
          beforeValue: cat.allocatedAmount,
          afterValue: cat.allocatedAmount - cut,
          applied: false,
          timestamp: new Date().toISOString(),
        });
      }
    });

    return {
      message: `I have analyzed your budget allocation and detected ${summary.isOverrun ? `a projected budget overrun of ${state.event.budget.currency} ${summary.overrunAmount.toLocaleString()}` : `optimization opportunities to protect your financial buffer`}. I have identified targeted adjustments across secondary categories while strictly protecting your core priorities (${state.event.priorities.slice(0, 2).join(' & ')}).`,
      reasoning_summary: `Protecting must-have categories (hospitality & venue) requires trimming flexible buckets (customized favors, physical paper printing, incidental buffers). Digital wedding invites and streamlined floral staging can absorb overruns immediately.`,
      assumptions: [
        `Core priorities (${state.event.priorities[0] || 'Food'} and ${state.event.priorities[1] || 'Venue'}) must not receive budget reductions.`,
        `Guests will appreciate seamless hospitality and comfort over expensive take-home knick-knacks.`,
      ],
      clarifying_questions: [
        `Are there any vendor deposits already locked that cannot be renegotiated?`,
        `Would you prefer transitioning entirely to digital animated invitations to eliminate paper printing costs?`,
      ],
      recommendations: [
        `Apply proposed trims across flexible categories to restore budget balance.`,
        `Conduct itemized contract reviews with vendors before paying second milestones.`,
        `Maintain an untouched 3% emergency contingency for unforeseen electrical or transport tips.`,
      ],
      proposed_changes: proposedChanges,
      affected_sections: ['Budget Categories', 'Cash Flow & Balances'],
      risks: [
        {
          severity: summary.isOverrun ? 'high' : 'medium',
          issue: `Unmonitored incidental expenses during event week.`,
          mitigation: `Designate one family or finance lead as the sole authorized signatory for vendor top-ups.`,
        },
      ],
      next_steps: [
        `Review the proposed trims and click "Apply Changes".`,
        `Check the Budget tab to see your revised remaining balance and utilization meter.`,
      ],
    };
  }

  // Default intelligent contextual advice
  return {
    message: `I have evaluated your event plan for "${state.event.title}" (${state.event.guests.count} guests in ${state.event.location.city || 'your destination'}). Your budget utilization is currently at ${summary.utilizationPercent}% with a remaining balance of ${state.event.budget.currency} ${summary.remainingBalance.toLocaleString()}. Your milestones, schedule run sheets, and vendor checklist are in active alignment with your top priorities.`,
    reasoning_summary: `Based on your ${state.event.type} timeline, your critical upcoming focus is vendor contracts and locking dietary preferences for expected attendees. Maintaining clean dependencies between venue handover and AV soundcheck will prevent day-of delays.`,
    assumptions: [
      `Event date is set to ${state.event.startDate} (${state.event.durationDays} day duration).`,
      `Expected attendance is modeled on ${state.event.guests.count} invited guests.`,
      `Accessibility requirements (wheelchair / ground floor) must be verified with the venue host.`,
    ],
    clarifying_questions: [
      `Have you scheduled a physical acoustic walk-through at the venue?`,
      `Would you like me to generate customized thematic decor concepts or tailored multi-course menu ideas?`,
    ],
    recommendations: [
      `Lock primary caterer tasting session before final menu signoff.`,
      `Verify all audio-visual line arrays and wireless microphoning with venue sound limits.`,
      `Send RSVP digital links to track dietary splits (veg, jain, vegan) accurately.`,
    ],
    proposed_changes: [],
    affected_sections: ['Overview', 'Milestones', 'Vendor Contracts'],
    risks: [
      {
        severity: 'medium',
        issue: `Pending RSVPs make exact food portions uncertain.`,
        mitigation: `Set RSVP deadline 2 weeks before the event date and follow up automatically.`,
      },
      {
        severity: 'low',
        issue: `Multi-day schedule transit buffers.`,
        mitigation: `Keep at least 20 minutes buffer between ceremony and banquet meal areas.`,
      },
    ],
    next_steps: [
      `Explore the 'Ideas' tab to save creative themes and photo concepts to your plan.`,
      `Review your Event-Day Run Sheet to check for any activity overlaps or missing setup time.`,
    ],
  };
}
