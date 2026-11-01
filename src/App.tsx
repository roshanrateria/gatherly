import { Suspense, lazy, useState } from 'react';
import { AppState, ProposedChange } from './types/index';
import { loadStoredState, saveStateToStorage } from './lib/storage';
import { createSampleWedding, createSampleCorporate, createSampleBirthday } from './lib/sampleEvents';
import { applyProposalsToState } from './lib/proposals';
import { createId } from './lib/createId';
import { Navbar, ActiveTab, PresetKey } from './components/Navbar';
import { AdaptiveSetupModal } from './components/AdaptiveSetupModal';
import { ProposalReviewModal } from './components/ProposalReviewModal';
import { ToastContainer, ToastMessage } from './components/Toast';

/**
 * Tabs are code-split so the initial bundle stays lean; each tab is its own
 * chunk that loads on first navigation.
 */
const OverviewTab = lazy(() =>
  import('./components/overview/OverviewTab').then(m => ({ default: m.OverviewTab })));
const AIPlannerTab = lazy(() =>
  import('./components/planner/AIPlannerTab').then(m => ({ default: m.AIPlannerTab })));
const BudgetTab = lazy(() =>
  import('./components/budget/BudgetTab').then(m => ({ default: m.BudgetTab })));
const TimelineTab = lazy(() =>
  import('./components/timeline/TimelineTab').then(m => ({ default: m.TimelineTab })));
const TasksTab = lazy(() =>
  import('./components/tasks/TasksTab').then(m => ({ default: m.TasksTab })));
const VendorsTab = lazy(() =>
  import('./components/vendors/VendorsTab').then(m => ({ default: m.VendorsTab })));
const GuestsTab = lazy(() =>
  import('./components/guests/GuestsTab').then(m => ({ default: m.GuestsTab })));
const ScheduleTab = lazy(() =>
  import('./components/schedule/ScheduleTab').then(m => ({ default: m.ScheduleTab })));
const IdeasTab = lazy(() =>
  import('./components/ideas/IdeasTab').then(m => ({ default: m.IdeasTab })));
const SettingsTab = lazy(() =>
  import('./components/settings/SettingsTab').then(m => ({ default: m.SettingsTab })));

function TabFallback() {
  return (
    <div className="py-24 text-center text-slate-500" role="status">
      <p>Loading workspace…</p>
    </div>
  );
}

export function App() {
  const [state, setState] = useState<AppState>(() => loadStoredState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Modals
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => {
    const id = createId('toast');
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync state changes to storage
  const handleUpdateState = (newState: AppState) => {
    setState(newState);
    saveStateToStorage(newState);
  };

  const handleSelectPreset = (presetKey: PresetKey) => {
    let preset: AppState;
    if (presetKey === 'wedding') preset = createSampleWedding();
    else if (presetKey === 'corporate') preset = createSampleCorporate();
    else preset = createSampleBirthday();

    handleUpdateState(preset);
    addToast('success', `Loaded ${preset.event.title}`);
  };

  // Unapplied Proposals Count
  const pendingProposals = (state.proposalsHistory || []).filter((p) => !p.applied);

  /**
   * Single proposal application entry point used for both one-off applies and
   * "apply everything". The whole batch is applied as one transaction through
   * the shared proposal engine, so no proposal ever reads stale state (the
   * previous implementation mutated via repeated setState calls based on the
   * same captured snapshot — only the last proposal survived).
   */
  const applyProposalsByIds = (proposalIds: string[]) => {
    const targets = (state.proposalsHistory || []).filter((p) => proposalIds.includes(p.id));
    if (targets.length === 0) return;

    const result = applyProposalsToState(state, targets);
    const appliedIds = new Set(result.applied.map((p) => p.id));

    const stampTimestamp = (proposal: ProposedChange): ProposedChange => {
      if (!appliedIds.has(proposal.id)) return proposal;
      const appliedAt = result.applied.find((p) => p.id === proposal.id)?.timestamp;
      return { ...proposal, applied: true, ...(appliedAt ? { timestamp: appliedAt } : {}) };
    };

    const updatedProposalsHistory = (result.state.proposalsHistory || []).map(stampTimestamp);
    const updatedChatHistory = (result.state.chatHistory || []).map((msg) => {
      if (msg.structuredResponse?.proposed_changes) {
        return {
          ...msg,
          structuredResponse: {
            ...msg.structuredResponse,
            proposed_changes: msg.structuredResponse.proposed_changes.map((p) =>
              appliedIds.has(p.id) ? { ...p, applied: true } : p
            ),
          },
        };
      }
      return msg;
    });

    handleUpdateState({
      ...result.state,
      proposalsHistory: updatedProposalsHistory,
      chatHistory: updatedChatHistory,
    });

    const appliedTitles = result.applied.map((p) => p.title);
    if (appliedTitles.length > 0) {
      addToast(
        'success',
        appliedTitles.length === 1
          ? 'Proposal Applied to Master Plan'
          : `${appliedTitles.length} Proposals Applied`,
        appliedTitles.length === 1 ? appliedTitles[0] : appliedTitles.slice(0, 3).join(' • ')
      );
    }
    const firstSkip = result.skipped[0];
    if (firstSkip) {
      addToast('warning', 'Some changes were skipped', skipSummary(result.skipped));
    }
  };

  const applySingleProposal = (proposalId: string) => {
    applyProposalsByIds([proposalId]);
  };

  const applyAllProposals = () => {
    applyProposalsByIds(pendingProposals.map((p) => p.id));
    setProposalModalOpen(false);
  };

  const rejectSingleProposal = (proposalId: string) => {
    const updated = (state.proposalsHistory || []).filter((p) => p.id !== proposalId);
    handleUpdateState({ ...state, proposalsHistory: updated });
    addToast('info', 'Proposal Dismissed');
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#19202E] flex flex-col antialiased selection:bg-purple-900 selection:text-white">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-purple-900 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      {/* Global Navigation Header */}
      <Navbar
        state={state}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSetup={() => setSetupModalOpen(true)}
        onSelectPreset={handleSelectPreset}
        unappliedProposalsCount={pendingProposals.length}
      />

      {/* Main Workspace Body */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Suspense fallback={<TabFallback />}>
          {activeTab === 'overview' && (
            <OverviewTab
              state={state}
              onNavigateTab={setActiveTab}
              onOpenProposalModal={() => setProposalModalOpen(true)}
              unappliedProposalsCount={pendingProposals.length}
            />
          )}

          {activeTab === 'planner' && (
            <AIPlannerTab
              state={state}
              onUpdateState={handleUpdateState}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'budget' && (
            <BudgetTab
              state={state}
              onUpdateState={handleUpdateState}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'timeline' && (
            <TimelineTab
              state={state}
              onUpdateState={handleUpdateState}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksTab
              state={state}
              onUpdateState={handleUpdateState}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'vendors' && (
            <VendorsTab
              state={state}
              onUpdateState={handleUpdateState}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'guests' && (
            <GuestsTab
              state={state}
              onUpdateState={handleUpdateState}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleTab
              state={state}
              onUpdateState={handleUpdateState}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'ideas' && (
            <IdeasTab
              state={state}
              onUpdateState={handleUpdateState}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              state={state}
              onUpdateState={handleUpdateState}
              onShowToast={addToast}
            />
          )}
        </Suspense>
      </main>

      {/* Adaptive Setup Modal (Natural language brief + Guided Wizard) */}
      <AdaptiveSetupModal
        isOpen={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        onEventCreated={(newState) => {
          handleUpdateState(newState);
          setActiveTab('overview');
          addToast('success', 'New Master Plan Created', newState.event.title);
        }}
        currentCurrency={state.event.budget.currency}
      />

      {/* Proposal Review Modal */}
      <ProposalReviewModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
        proposals={state.proposalsHistory || []}
        onApplySingle={applySingleProposal}
        onApplyAll={applyAllProposals}
        onRejectSingle={rejectSingleProposal}
      />
    </div>
  );
}

/** Skips display: mention first two, then the remainder count. */
function skipSummary(skipped: Array<{ title: string; reason: string }>): string {
  if (skipped.length === 1) return `${skipped[0].title}: ${skipped[0].reason}`;
  const shown = skipped.slice(0, 2);
  const rest = skipped.length - shown.length;
  return `${shown.map(s => s.title).join(' • ')}${rest > 0 ? ` (+${rest} more)` : ''}`;
}

export default App;
