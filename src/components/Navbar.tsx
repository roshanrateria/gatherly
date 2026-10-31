import React from 'react';
import {
  Sparkles,
  LayoutDashboard,
  Bot,
  PieChart,
  CalendarDays,
  CheckSquare,
  Users2,
  Clock,
  Lightbulb,
  Settings,
  Plus,
  ShieldCheck,
  Cpu,
  Calendar,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { AppState } from '../types/index';
import { calculateDaysBetween } from '../lib/deterministicTimeline';
import { calculateBudgetSummary } from '../lib/deterministicBudget';
import { detectScheduleConflicts } from '../lib/deterministicSchedule';

export type ActiveTab =
  | 'overview'
  | 'planner'
  | 'budget'
  | 'timeline'
  | 'tasks'
  | 'vendors'
  | 'guests'
  | 'schedule'
  | 'ideas'
  | 'settings';

interface NavbarProps {
  state: AppState;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenSetup: () => void;
  onSelectPreset: (presetKey: 'wedding' | 'birthday' | 'corporate') => void;
  unappliedProposalsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  state,
  activeTab,
  onTabChange,
  onOpenSetup,
  onSelectPreset,
  unappliedProposalsCount,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const daysUntil = calculateDaysBetween(todayStr, state.event.startDate);

  const budgetSummary = calculateBudgetSummary(
    state.event.budget.total,
    state.categories,
    state.expenses,
    state.guests.length || state.event.guests.count
  );

  const conflicts = detectScheduleConflicts(state.schedule);
  const criticalConflicts = conflicts.filter((c) => c.severity === 'critical');
  const atRiskMilestones = state.milestones.filter((m) => m.isAtRisk && !m.completed);
  const activeTasks = state.tasks.filter((t) => t.status !== 'done');
  const savedIdeasCount = state.ideas.filter((i) => i.status === 'saved').length;

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'planner',
      label: 'AI Planner',
      icon: <Bot className="w-4 h-4" />,
      badge: unappliedProposalsCount > 0 ? (
        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full animate-pulse">
          {unappliedProposalsCount}
        </span>
      ) : null,
    },
    {
      id: 'budget',
      label: 'Budget',
      icon: <PieChart className="w-4 h-4" />,
      badge: budgetSummary.isOverrun ? (
        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full">
          !
        </span>
      ) : null,
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: <CalendarDays className="w-4 h-4" />,
      badge: atRiskMilestones.length > 0 ? (
        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
          {atRiskMilestones.length}
        </span>
      ) : null,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: <CheckSquare className="w-4 h-4" />,
      badge: activeTasks.length > 0 ? (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-700 rounded-full">
          {activeTasks.length}
        </span>
      ) : null,
    },
    {
      id: 'vendors',
      label: 'Vendors',
      icon: <Building2 className="w-4 h-4" />,
      badge: state.vendors.length > 0 ? (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-700 rounded-full">
          {state.vendors.length}
        </span>
      ) : null,
    },
    {
      id: 'guests',
      label: 'Guests',
      icon: <Users2 className="w-4 h-4" />,
      badge: state.guests.length > 0 ? (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-700 rounded-full">
          {state.guests.length}
        </span>
      ) : null,
    },
    {
      id: 'schedule',
      label: 'Schedule',
      icon: <Clock className="w-4 h-4" />,
      badge: criticalConflicts.length > 0 ? (
        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full">
          {criticalConflicts.length}
        </span>
      ) : null,
    },
    {
      id: 'ideas',
      label: 'Ideas',
      icon: <Lightbulb className="w-4 h-4" />,
      badge: savedIdeasCount > 0 ? (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 rounded-full">
          {savedIdeasCount}
        </span>
      ) : null,
    },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E7E0D6] shadow-xs">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-900 via-rose-900 to-amber-600 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-editorial text-2xl font-bold tracking-tight text-slate-900">
                  Gatherly
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-md bg-purple-100 text-purple-900 border border-purple-200">
                  GenAI Planner
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Celebration &amp; Event Orchestration
              </p>
            </div>
          </div>

          {/* Center Info: Current Event Title + Countdown */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FAF7F2] border border-[#E7E0D6] rounded-lg">
              <Calendar className="w-4 h-4 text-purple-900 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-900 max-w-[220px] truncate">
                  {state.event.title}
                </p>
                <p className="text-[10px] text-slate-500">
                  {state.event.location.city || 'Destination'} • {state.event.startDate}
                </p>
              </div>
            </div>

            {/* Countdown Pill */}
            <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>
                {daysUntil > 0 ? (
                  <>
                    <strong className="font-bold text-amber-950">{daysUntil}</strong> days to go
                  </>
                ) : daysUntil === 0 ? (
                  <strong className="text-rose-700 font-bold">Event Day Today!</strong>
                ) : (
                  <span>Event concluded</span>
                )}
              </span>
            </div>
          </div>

          {/* Right Actions: AI Provider Pill + Sample Switcher + Setup CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* AI Status Badge */}
            <button
              onClick={() => onTabChange('settings')}
              title="Click to configure AI Model & API Keys"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border cursor-pointer hover:bg-slate-50"
            >
              {state.aiConfig.provider === 'offline' ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden lg:inline text-slate-700">Offline Expert</span>
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-semibold rounded">
                    Free
                  </span>
                </>
              ) : (
                <>
                  <Cpu className="w-3.5 h-3.5 text-purple-700" />
                  <span className="hidden lg:inline text-purple-900 font-semibold uppercase text-[10px]">
                    {state.aiConfig.provider}
                  </span>
                  <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[10px] font-semibold rounded">
                    Live
                  </span>
                </>
              )}
            </button>

            {/* Sample Presets Dropdown */}
            <div className="hidden sm:block">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onSelectPreset(e.target.value as any);
                    e.target.value = '';
                  }
                }}
                className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-700/20"
                defaultValue=""
              >
                <option value="" disabled>
                  Load Sample Event...
                </option>
                <option value="wedding">Udaipur Royal Wedding (3-Day)</option>
                <option value="corporate">Tech Leadership Summit (350 Pax)</option>
                <option value="birthday">Milestone 40th Birthday (Goa)</option>
              </select>
            </div>

            {/* Adaptive Setup Button */}
            <button
              onClick={onOpenSetup}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-900 to-rose-900 text-white shadow-xs hover:from-purple-950 hover:to-rose-950 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Adaptive Setup</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-none">
        <nav className="flex space-x-1 sm:space-x-2 py-1.5 min-w-max" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
