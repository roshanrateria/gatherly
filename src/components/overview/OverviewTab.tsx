import React from 'react';
import {
  Users,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Clock,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { AppState } from '../../types/index';
import { calculateBudgetSummary } from '../../lib/deterministicBudget';
import { formatCurrency } from '../../lib/currency';
import { budgetBasisGuestCount, computeGuestMetrics } from '../../lib/guestMetrics';
import { daysBetweenISO, todayISO } from '../../lib/dates';
import { ActiveTab } from '../Navbar';

interface OverviewTabProps {
  state: AppState;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenProposalModal: () => void;
  unappliedProposalsCount: number;
}

type NextStep = {
  title: string;
  desc: string;
  actionTab: ActiveTab;
  badge: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  /** When set, the row triggers this direct action instead of tab navigation. */
  directAction?: () => void;
};

export const OverviewTab: React.FC<OverviewTabProps> = ({
  state,
  onNavigateTab,
  onOpenProposalModal,
  unappliedProposalsCount,
}) => {
  const { event, categories, expenses, milestones, tasks, vendors, guests } = state;
  const currency = event.budget.currency;
  const numFormat = event.budget.numberFormat;

  const todayStr = todayISO();
  const daysRemaining = daysBetweenISO(todayStr, event.startDate);

  // Deterministic calculations (roster-aware guest basis, never party size)
  const budgetSummary = calculateBudgetSummary(
    event.budget.total,
    categories,
    expenses,
    budgetBasisGuestCount(state)
  );

  // Guests summary: real RSVP arithmetic from the roster
  const guestMetrics = computeGuestMetrics(guests);
  const rosterHasData = guests.length > 0;
  const expectedGuests = rosterHasData
    ? guestMetrics.expectedAttendance
    : event.guests.expectedAttendance;
  const expectedGuestsBasis = rosterHasData
    ? `${guestMetrics.confirmedHeadcount} confirmed${guestMetrics.tentativeHeadcount > 0 ? ` + 50% of ${guestMetrics.tentativeHeadcount} tentative` : ''} from ${guestMetrics.invitedHeadcount} invited`
    : `Estimate without RSVP data — target invited ${event.guests.count}`;

  // Tasks summary
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const totalTasks = tasks.length;
  const taskProgressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Milestones summary
  const atRiskMilestones = milestones.filter((m) => m.isAtRisk && !m.completed);

  // Vendors summary
  const bookedVendors = vendors.filter(
    (v) =>
      v.bookingStatus === 'contract_signed' ||
      v.bookingStatus === 'deposit_paid' ||
      v.bookingStatus === 'fully_paid'
  ).length;

  // Health Score Calculation (0-100)
  let healthScore = 75;
  if (!budgetSummary.isOverrun) healthScore += 10;
  else healthScore -= 15;
  if (atRiskMilestones.length === 0) healthScore += 10;
  else healthScore -= Math.min(20, atRiskMilestones.length * 5);
  if (taskProgressPct > 40) healthScore += 5;
  healthScore = Math.max(20, Math.min(98, healthScore));

  // Dynamic Next Steps based on state
  const dynamicNextSteps: NextStep[] = [];
  if (unappliedProposalsCount > 0) {
    dynamicNextSteps.push({
      title: 'Review Pending AI Proposals',
      desc: `${unappliedProposalsCount} optimization proposal${unappliedProposalsCount === 1 ? '' : 's'} waiting for review.`,
      actionTab: 'planner' as ActiveTab,
      badge: 'Action Required',
      priority: 'urgent',
      directAction: onOpenProposalModal,
    });
  }
  if (budgetSummary.isOverrun) {
    dynamicNextSteps.push({
      title: 'Resolve Projected Budget Overrun',
      desc: `Expenses exceed allocation by ${formatCurrency(budgetSummary.overrunAmount, currency, numFormat)}. Review trade-offs.`,
      actionTab: 'budget' as ActiveTab,
      badge: 'Overrun Alert',
      priority: 'high',
    });
  }
  if (atRiskMilestones.length > 0) {
    dynamicNextSteps.push({
      title: 'Address At-Risk Milestones',
      desc: `${atRiskMilestones.length} milestones past or nearing deadline without completion.`,
      actionTab: 'timeline' as ActiveTab,
      badge: 'Deadlines',
      priority: 'high',
    });
  }
  if (vendors.length < 3) {
    dynamicNextSteps.push({
      title: 'Shortlist Core Vendors',
      desc: 'Add photographer, venue, or caterer options for side-by-side comparison.',
      actionTab: 'vendors' as ActiveTab,
      badge: 'Vendors',
      priority: 'medium',
    });
  }
  if (guests.length === 0) {
    dynamicNextSteps.push({
      title: 'Import Guest List & RSVP Tracker',
      desc: 'Upload CSV or add key guests to sync catering headcount estimates.',
      actionTab: 'guests' as ActiveTab,
      badge: 'Headcount',
      priority: 'medium',
    });
  }
  if (dynamicNextSteps.length < 3) {
    dynamicNextSteps.push({
      title: 'Fine-tune Event-Day Run Sheet',
      desc: 'Check activity schedules for multi-day transitions or missing setup buffers.',
      actionTab: 'schedule' as ActiveTab,
      badge: 'Run Sheet',
      priority: 'low',
    });
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Hero Banner: Event Title & Live Countdown */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2A182E] via-[#3B1D38] to-[#1E2538] text-white p-6 sm:p-8 shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-amber-400/20 text-amber-200 border border-amber-300/30">
                {event.type.replace('_', ' ')} • {event.durationDays} Day
                {event.durationDays > 1 ? 's' : ''}
              </span>
              <span className="text-xs text-slate-300">
                {event.location.city || 'Destination'} {event.location.venueName ? `• ${event.location.venueName}` : ''}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-editorial tracking-tight text-white">
              {event.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed">
              Style: {event.style || 'Custom curated celebration'}. Priorities:{' '}
              {event.priorities.slice(0, 3).join(', ')}.
            </p>
          </div>

          {/* Countdown & Health Score Badges */}
          <div className="flex flex-row md:flex-col items-center md:items-end gap-3 shrink-0">
            <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 text-center min-w-[130px]">
              <span className="text-[10px] font-semibold text-amber-200 uppercase tracking-wider block">
                Countdown
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-white">
                {daysRemaining > 0 ? daysRemaining : 0}
              </span>
              <span className="text-[11px] text-slate-300 block">
                {daysRemaining > 0 ? 'Days Remaining' : 'Celebration Today!'}
              </span>
            </div>

            <div className="p-2.5 bg-emerald-950/40 backdrop-blur-md rounded-xl border border-emerald-400/30 text-right flex items-center gap-2.5">
              <div className="text-right">
                <span className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider block">
                  Plan Health
                </span>
                <span className="text-sm font-bold text-emerald-300">{healthScore} / 100</span>
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-emerald-400 flex items-center justify-center text-[11px] font-bold text-emerald-200">
                {healthScore}%
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budget Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Target Budget</span>
            <DollarSign className="w-4 h-4 text-purple-800" aria-hidden="true" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900">
            {formatCurrency(budgetSummary.totalBudget, currency, numFormat)}
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-slate-600">Remaining</span>
            <span
              className={`font-semibold ${
                budgetSummary.remainingBalance < 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {formatCurrency(budgetSummary.remainingBalance, currency, numFormat)}
            </span>
          </div>
        </div>

        {/* Guests Attendance Card: RSVP-driven expectation, kept separate from target count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Expected Guests</span>
            <Users className="w-4 h-4 text-indigo-700" aria-hidden="true" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900">
            {expectedGuests} Pax
          </div>
          <div
            className="flex items-center justify-between text-[11px] pt-1 gap-2"
            title={expectedGuestsBasis}
          >
            <span className="text-slate-600 shrink-0">
              {rosterHasData
                ? `${guestMetrics.confirmedHeadcount} confirmed`
                : 'Target headcount'}
            </span>
            <span className="font-semibold text-slate-700 text-right">
              {rosterHasData
                ? `${guestMetrics.invitedHeadcount} invited`
                : `${event.guests.count} invited`}
            </span>
          </div>
        </div>

        {/* Task Progress Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Tasks Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900">
            {completedTasks} / {totalTasks} ({taskProgressPct}%)
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2" role="status" aria-label={`Task progress: ${taskProgressPct}%`}>
            <div
              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${taskProgressPct}%` }}
            />
          </div>
        </div>

        {/* Vendors Status Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Vendors Booked</span>
            <Building2 className="w-4 h-4 text-amber-700" aria-hidden="true" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900">
            {bookedVendors} of {vendors.length} Contracted
          </div>
          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-slate-600">Payments Disbursed</span>
            <span className="font-semibold text-slate-700">
              {formatCurrency(budgetSummary.totalPaid, currency, numFormat)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Dynamic Next Steps + Budget Allocation Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recommended Next Steps */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-900" aria-hidden="true" />
                <h3 className="text-base font-bold text-slate-900 font-editorial">
                  Recommended Next Steps
                </h3>
              </div>
              <span className="text-xs text-slate-600">Adaptive Dynamic Priority Engine</span>
            </div>

            <ul className="space-y-2.5 list-none">
              {dynamicNextSteps.map((step, idx) => {
                const priorityStyles = {
                  urgent: 'border-l-4 border-l-rose-500 bg-rose-50/50',
                  high: 'border-l-4 border-l-amber-500 bg-amber-50/40',
                  medium: 'border-l-4 border-l-purple-500 bg-purple-50/30',
                  low: 'border-l-4 border-l-slate-400 bg-slate-50/50',
                }[step.priority];

                return (
                  <li key={`${step.title}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (step.directAction) step.directAction();
                        else onNavigateTab(step.actionTab);
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border border-slate-200/80 hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center justify-between gap-3 cursor-pointer group focus-visible:outline-hidden ${priorityStyles}`}
                    >
                      <span className="space-y-0.5">
                        <span className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-purple-900 transition-colors">
                            {step.title}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-white border border-slate-200 text-slate-700">
                            {step.badge}
                          </span>
                        </span>
                        <span className="block text-xs text-slate-700 leading-relaxed">{step.desc}</span>
                      </span>

                      <span
                        className="shrink-0 p-1.5 rounded-lg text-slate-500 group-hover:text-purple-900 group-hover:bg-purple-100 transition-colors"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Upcoming Key Milestones */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-800" aria-hidden="true" />
                <h3 className="text-base font-bold text-slate-900 font-editorial">
                  Key Upcoming Milestones
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('timeline')}
                className="text-xs font-semibold text-purple-900 hover:text-purple-950 flex items-center gap-1 cursor-pointer"
              >
                <span>View Timeline</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <ul className="space-y-2.5 list-none">
              {milestones.slice(0, 4).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-[#FAF9F7] text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        m.completed
                          ? 'bg-emerald-500'
                          : m.isAtRisk
                          ? 'bg-rose-500 animate-pulse'
                          : 'bg-amber-500'
                      }`}
                      aria-hidden="true"
                    />
                    <div>
                      <span className={`font-semibold ${m.completed ? 'line-through text-slate-600' : 'text-slate-900'}`}>
                        {m.title}
                      </span>
                      <span className="text-[11px] text-slate-600 block">
                        Category: {m.category} • Due: {m.dueDate}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      m.completed
                        ? 'bg-emerald-100 text-emerald-800'
                        : m.isAtRisk
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {m.completed ? 'Done' : m.isAtRisk ? 'At Risk' : `${m.daysBeforeEvent}d before`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right 1 Col: Visual Budget Allocation Breakdown */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 font-editorial">
                Budget Allocation
              </h3>
              <button
                onClick={() => onNavigateTab('budget')}
                className="text-xs font-semibold text-purple-900 hover:text-purple-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Details</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-700">Per-Guest Target</span>
                <strong className="text-purple-950 font-bold">
                  {formatCurrency(
                    Math.round(budgetSummary.totalBudget / Math.max(1, event.guests.count)),
                    currency,
                    numFormat
                  )}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Allocated</span>
                <strong className="text-slate-900 font-semibold">
                  {formatCurrency(budgetSummary.totalAllocated, currency, numFormat)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700">Committed (Actual)</span>
                <strong className="text-slate-900 font-semibold">
                  {formatCurrency(budgetSummary.totalActual, currency, numFormat)}
                </strong>
              </div>
            </div>

            {/* Categories Distribution Stacked Bar */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Category Distribution
              </span>
              <div className="space-y-2">
                {categories.slice(0, 5).map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate max-w-[170px]">
                        {cat.name}
                      </span>
                      <span className="text-slate-900 font-bold">
                        {cat.allocationPercent}% (
                        {formatCurrency(cat.allocatedAmount, currency, numFormat)})
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-purple-900 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, cat.allocationPercent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning if overrun */}
            {budgetSummary.isOverrun && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2" role="alert">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="font-bold block">Overrun Warning</strong>
                  Expenses exceed budget by{' '}
                  {formatCurrency(budgetSummary.overrunAmount, currency, numFormat)}. Review trade-offs in
                  the Budget tab.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
