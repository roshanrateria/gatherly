import React, { useState, useEffect } from 'react';
import { AppState, ProposedChange } from './types/index';
import { loadStoredState, saveStateToStorage } from './lib/storage';
import { createSampleWedding, createSampleCorporate, createSampleBirthday } from './lib/sampleEvents';
import { Navbar, ActiveTab } from './components/Navbar';
import { OverviewTab } from './components/overview/OverviewTab';
import { AIPlannerTab } from './components/planner/AIPlannerTab';
import { BudgetTab } from './components/budget/BudgetTab';
import { TimelineTab } from './components/timeline/TimelineTab';
import { TasksTab } from './components/tasks/TasksTab';
import { VendorsTab } from './components/vendors/VendorsTab';
import { GuestsTab } from './components/guests/GuestsTab';
import { ScheduleTab } from './components/schedule/ScheduleTab';
import { IdeasTab } from './components/ideas/IdeasTab';
import { SettingsTab } from './components/settings/SettingsTab';
import { AdaptiveSetupModal } from './components/AdaptiveSetupModal';
import { ProposalReviewModal } from './components/ProposalReviewModal';
import { ToastContainer, ToastMessage } from './components/Toast';

export function App() {
  const [state, setState] = useState<AppState>(() => loadStoredState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Modals
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'warning' | 'error' | 'info', title: string, message?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

  const handleSelectPreset = (presetKey: 'wedding' | 'birthday' | 'corporate') => {
    let preset: AppState;
    if (presetKey === 'wedding') preset = createSampleWedding();
    else if (presetKey === 'corporate') preset = createSampleCorporate();
    else preset = createSampleBirthday();

    handleUpdateState(preset);
    addToast('success', `Loaded ${preset.event.title}`);
  };

  // Unapplied Proposals Count
  const pendingProposals = (state.proposalsHistory || []).filter((p) => !p.applied);

  // Proposal Application Engine
  const applySingleProposal = (proposalId: string) => {
    const proposal = (state.proposalsHistory || []).find((p) => p.id === proposalId);
    if (!proposal) return;

    let newState = { ...state };

    if (proposal.section === 'guest') {
      const newGuestCount = Number(proposal.afterValue);
      if (!isNaN(newGuestCount) && newGuestCount > 0) {
        newState = {
          ...newState,
          event: {
            ...newState.event,
            guests: {
              ...newState.event.guests,
              count: newGuestCount,
              expectedAttendance: Math.round(newGuestCount * 0.95),
            },
            updatedAt: new Date().toISOString(),
          },
        };
      }
    } else if (proposal.section === 'budget') {
      if (typeof proposal.afterValue === 'object') {
        const decorDiff = proposal.afterValue.decorAllocated;
        const cateringDiff = proposal.afterValue.cateringAllocated;
        const photoDiff = proposal.afterValue.photoAllocated;

        const updatedCategories = newState.categories.map((cat) => {
          if (decorDiff !== undefined && (cat.name.toLowerCase().includes('decor') || cat.name.toLowerCase().includes('floral'))) {
            return {
              ...cat,
              allocatedAmount: decorDiff,
              allocationPercent: Math.round((decorDiff / newState.event.budget.total) * 100),
            };
          }
          if (cateringDiff !== undefined && (cat.name.toLowerCase().includes('cater') || cat.name.toLowerCase().includes('food'))) {
            return {
              ...cat,
              allocatedAmount: cateringDiff,
              allocationPercent: Math.round((cateringDiff / newState.event.budget.total) * 100),
            };
          }
          if (photoDiff !== undefined && cat.name.toLowerCase().includes('photo')) {
            return {
              ...cat,
              allocatedAmount: photoDiff,
              allocationPercent: Math.round((photoDiff / newState.event.budget.total) * 100),
            };
          }
          return cat;
        });

        newState = {
          ...newState,
          categories: updatedCategories,
          event: { ...newState.event, updatedAt: new Date().toISOString() },
        };
      }
    }

    // Mark proposal as applied
    const updatedProposals = (newState.proposalsHistory || []).map((p) =>
      p.id === proposalId ? { ...p, applied: true } : p
    );

    const updatedChatHistory = newState.chatHistory.map((msg) => {
      if (msg.structuredResponse?.proposed_changes) {
        return {
          ...msg,
          structuredResponse: {
            ...msg.structuredResponse,
            proposed_changes: msg.structuredResponse.proposed_changes.map((p) =>
              p.id === proposalId ? { ...p, applied: true } : p
            ),
          },
        };
      }
      return msg;
    });

    handleUpdateState({
      ...newState,
      proposalsHistory: updatedProposals,
      chatHistory: updatedChatHistory,
    });

    addToast('success', 'Proposal Applied to Master Plan', proposal.title);
  };

  const applyAllProposals = () => {
    pendingProposals.forEach((p) => applySingleProposal(p.id));
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

export default App;
