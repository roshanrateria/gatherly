import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  Cpu,
  Check,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { AppState, ChatMessage, ProposedChange } from '../../types/index';
import {
  generateAIPlanResponse,
  describeError,
} from '../../lib/aiService';
import { applyProposalsToState } from '../../lib/proposals';
import { createId } from '../../lib/createId';
import { formatCurrency } from '../../lib/currency';

interface AIPlannerTabProps {
  state: AppState;
  onUpdateState: (newState: AppState) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg?: string) => void;
}

export const AIPlannerTab: React.FC<AIPlannerTabProps> = ({
  state,
  onUpdateState,
  onShowToast,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const quickPrompts = [
    {
      label: 'Increase guests to 350 (fixed budget)',
      text: `We need to increase guests from ${state.event.guests.count} to 350, but our total budget is strictly fixed at ${state.event.budget.currency} ${state.event.budget.total.toLocaleString()}. Please calculate pressure points and propose trade-offs.`,
    },
    {
      label: 'Prioritize Photography over Decor',
      text: 'Photography and candid cinematography are now a much higher priority for us than decoration. Please propose a suitable reallocation of funds.',
    },
    {
      label: 'Scan for Budget Leaks & Overruns',
      text: 'Analyze our current budget allocations, identify potential overruns or unallocated reserves, and suggest savings that protect our must-haves.',
    },
    {
      label: 'Evaluate Timeline & Day-of Schedule',
      text: 'Inspect our milestones and run sheet for any tight transitions, missing setup buffers, or overdue tasks.',
    },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt || isLoading) return;

    const userMsg: ChatMessage = {
      id: createId('msg_user'),
      sender: 'user',
      timestamp: new Date().toISOString(),
      text: prompt,
    };

    const updatedHistory = [...state.chatHistory, userMsg];
    setInputText('');
    setIsLoading(true);

    try {
      const { response } = await generateAIPlanResponse(
        prompt,
        { ...state, chatHistory: updatedHistory },
        state.aiConfig
      );

      const assistantMsg: ChatMessage = {
        id: createId('msg_ai'),
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        text: response.message,
        structuredResponse: response,
      };

      // Add proposed changes to proposalsHistory
      const newProposals = [...(state.proposalsHistory || [])];
      if (response.proposed_changes && response.proposed_changes.length > 0) {
        response.proposed_changes.forEach((pc) => {
          if (!newProposals.some((p) => p.id === pc.id)) {
            newProposals.push(pc);
          }
        });
      }

      onUpdateState({
        ...state,
        chatHistory: [...updatedHistory, assistantMsg],
        proposalsHistory: newProposals,
      });

      if (response.proposed_changes && response.proposed_changes.length > 0) {
        onShowToast(
          'info',
          'New Actionable Proposals Generated',
          `${response.proposed_changes.length} change proposal(s) available to review and apply.`
        );
      }
    } catch (err: unknown) {
      console.error('Error generating AI plan response:', err);
      onShowToast('error', 'AI Generation Failed', describeError(err));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Applies one proposal through the shared proposal engine — the exact same
   * validated path used by Dashboard's Proposal Review flow.
   */
  const applyProposal = (proposal: ProposedChange) => {
    const result = applyProposalsToState(state, [proposal]);
    const appliedIds = new Set(result.applied.map((p) => p.id));

    if (appliedIds.size === 0) {
      const skipped = result.skipped[0];
      onShowToast(
        'warning',
        'Proposal Not Applied',
        skipped ? `${skipped.title}: ${skipped.reason}` : 'This proposal could not be applied.'
      );
      return;
    }

    const markApplied = <T extends { id: string; applied?: boolean }>(item: T): T =>
      appliedIds.has(item.id) ? ({ ...item, applied: true } as T) : item;

    onUpdateState({
      ...result.state,
      chatHistory: (result.state.chatHistory || []).map((msg) =>
        msg.structuredResponse?.proposed_changes
          ? {
              ...msg,
              structuredResponse: {
                ...msg.structuredResponse,
                proposed_changes: msg.structuredResponse.proposed_changes.map(markApplied),
              },
            }
          : msg
      ),
      proposalsHistory: (result.state.proposalsHistory || []).map(markApplied),
    });

    onShowToast('success', 'Changes Applied Successfully!', proposal.title);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[600px] max-w-6xl mx-auto space-y-4 pb-6">
      {/* Header Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-900 text-amber-300 flex items-center justify-center">
            <Bot className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 font-editorial">
              Context-Aware AI Celebration Planner
            </h2>
            <p className="text-xs text-slate-600">
              Continuously reasoning over {state.event.guests.count} guests,{' '}
              {formatCurrency(state.event.budget.total, state.event.budget.currency, state.event.budget.numberFormat)} budget, and real-time constraints
            </p>
          </div>
        </div>

        {/* AI Status Badge */}
        <div className="flex items-center gap-2">
          {state.aiConfig.provider === 'offline' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-900 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>Offline Expert System (Deterministic &amp; Private)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-purple-900 text-xs font-semibold">
              <Cpu className="w-4 h-4 text-purple-700" aria-hidden="true" />
              <span className="uppercase">{state.aiConfig.provider} Live</span>
              <span className="text-slate-600 text-[10px]">({state.aiConfig.model})</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Prompts Carousel */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-slate-600 font-medium shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" /> Try:
        </span>
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            disabled={isLoading}
            onClick={() => handleSendMessage(qp.text)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-medium transition-colors hover:border-purple-300 cursor-pointer text-left disabled:opacity-50"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Chat Messages Container */}
      <div
        className="flex-1 bg-[#FAF9F6] border border-slate-200 rounded-2xl p-4 sm:p-6 overflow-y-auto space-y-6"
        role="log"
        aria-live="polite"
        aria-label="Planner conversation history"
      >
        {state.chatHistory.map((msg) => {
          const isUser = msg.sender === 'user';
          const structured = msg.structuredResponse;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center shadow-xs ${
                  isUser
                    ? 'bg-slate-800 text-white'
                    : 'bg-gradient-to-br from-purple-900 to-rose-900 text-amber-200'
                }`}
                aria-hidden="true"
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Content */}
              <div className={`max-w-3xl space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Main bubble */}
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none space-y-3'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* If assistant has structured reasoning */}
                  {structured && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      {/* Reasoning Summary & Assumptions */}
                      {structured.reasoning_summary && (
                        <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-purple-700" aria-hidden="true" />
                            Planner Reasoning Summary
                          </span>
                          <p className="text-xs text-purple-900 leading-relaxed">
                            {structured.reasoning_summary}
                          </p>
                        </div>
                      )}

                      {/* Assumptions */}
                      {structured.assumptions && structured.assumptions.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                            Operating Assumptions
                          </span>
                          <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                            {structured.assumptions.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Actionable Proposed Changes (The Core Requirement) */}
                      {structured.proposed_changes && structured.proposed_changes.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                            Actionable Proposals ({structured.proposed_changes.length})
                          </span>

                          <ul className="space-y-2 list-none">
                            {structured.proposed_changes.map((prop) => (
                              <li
                                key={prop.id}
                                className={`p-3.5 rounded-xl border transition-all ${
                                  prop.applied
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                    : 'bg-amber-50/60 border-amber-300 text-amber-950'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold">{prop.title}</span>
                                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase bg-white border border-slate-200 text-slate-700">
                                        {prop.section}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                                      {prop.description}
                                    </p>
                                  </div>

                                  {prop.applied ? (
                                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-white border border-emerald-300 px-2.5 py-1 rounded-lg">
                                      <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                                      Applied
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => applyProposal(prop)}
                                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-purple-900 hover:bg-purple-950 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                      <span>Apply Changes</span>
                                    </button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risks with mitigations */}
                      {structured.risks && structured.risks.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                            Detected Risks &amp; Mitigations
                          </span>
                          <ul className="space-y-1.5 list-none">
                            {structured.risks.map((r, i) => (
                              <li
                                key={i}
                                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-start gap-2"
                              >
                                <span
                                  className={`px-1.5 py-0.2 text-[9px] font-bold rounded uppercase mt-0.5 ${
                                    r.severity === 'high'
                                      ? 'bg-rose-100 text-rose-800'
                                      : r.severity === 'medium'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-blue-100 text-blue-900'
                                  }`}
                                >
                                  {r.severity}
                                </span>
                                <div>
                                  <strong className="text-slate-800 font-semibold">{r.issue}</strong>
                                  <span className="text-slate-700 block mt-0.5">
                                    Mitigation: {r.mitigation}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-600 block px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3" role="status" aria-label="Planner is thinking">
            <div className="w-8 h-8 rounded-xl bg-purple-900 text-amber-300 flex items-center justify-center animate-pulse">
              <Bot className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="bg-white p-3.5 rounded-2xl rounded-tl-none border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-700" aria-hidden="true" />
              <span>Analyzing constraints, recalculating trade-offs and drafting plan...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="planner-input" className="sr-only">
            Message to the planner
          </label>
          <input
            id="planner-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about budget trade-offs, changing headcount, timeline adjustments, or run-sheet..."
            className="flex-1 text-xs sm:text-sm px-3 py-2 border-0 outline-hidden focus:ring-0 text-slate-800 placeholder-slate-500 bg-transparent"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="px-4 py-2 bg-gradient-to-r from-purple-900 to-rose-900 text-white rounded-xl text-xs font-bold hover:from-purple-950 hover:to-rose-950 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
};
