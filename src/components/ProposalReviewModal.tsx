import React from 'react';
import { X, Check, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ProposedChange } from '../types/ai';

interface ProposalReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposals: ProposedChange[];
  onApplySingle: (proposalId: string) => void;
  onApplyAll: () => void;
  onRejectSingle: (proposalId: string) => void;
}

export const ProposalReviewModal: React.FC<ProposalReviewModalProps> = ({
  isOpen,
  onClose,
  proposals,
  onApplySingle,
  onApplyAll,
  onRejectSingle,
}) => {
  if (!isOpen) return null;

  const pendingProposals = proposals.filter((p) => !p.applied);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden transition-all animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-700 via-rose-900 to-purple-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-amber-200" />
            </div>
            <div>
              <h3 className="text-base font-bold font-editorial">
                Review &amp; Apply AI Proposals ({pendingProposals.length} Pending)
              </h3>
              <p className="text-xs text-amber-100">
                Inspect calculated trade-offs and diffs before applying to your workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Pending Proposals */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {pendingProposals.length === 0 ? (
            <div className="text-center py-8">
              <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-slate-800">No Pending Proposals</h4>
              <p className="text-xs text-slate-500 mt-1">
                All recommendations and constraint trade-offs have already been applied or dismissed.
              </p>
            </div>
          ) : (
            pendingProposals.map((prop) => (
              <div
                key={prop.id}
                className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                    Section: {prop.section}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(prop.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900">{prop.title}</h4>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {prop.description}
                  </p>
                </div>

                {/* Diff Comparison if available */}
                {(prop.beforeValue !== undefined || prop.afterValue !== undefined) && (
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-medium">
                        Current Value
                      </span>
                      <span className="text-slate-700 font-medium">
                        {typeof prop.beforeValue === 'object'
                          ? JSON.stringify(prop.beforeValue)
                          : String(prop.beforeValue ?? 'Default')}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-purple-700 shrink-0 mx-2" />
                    <div className="text-right">
                      <span className="text-[10px] text-purple-800 block uppercase font-bold">
                        Proposed Update
                      </span>
                      <span className="text-purple-950 font-bold">
                        {typeof prop.afterValue === 'object'
                          ? JSON.stringify(prop.afterValue)
                          : String(prop.afterValue)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Single Proposal Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => onRejectSingle(prop.id)}
                    className="text-xs px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => onApplySingle(prop.id)}
                    className="flex items-center gap-1 text-xs px-3 py-1 font-semibold text-white bg-purple-900 hover:bg-purple-950 rounded-lg shadow-xs transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply This Change</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
          {pendingProposals.length > 0 && (
            <button
              onClick={onApplyAll}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-900 to-rose-900 hover:from-purple-950 hover:to-rose-950 rounded-xl shadow-sm transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Apply All ({pendingProposals.length}) Changes</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
