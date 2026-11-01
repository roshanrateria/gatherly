import React from 'react';
import { Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { ProposedChange } from '../types/ai';
import { ModalShell } from './ui/ModalShell';

interface ProposalReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposals: ProposedChange[];
  onApplySingle: (proposalId: string) => void;
  onApplyAll: () => void;
  onRejectSingle: (proposalId: string) => void;
}

/** Renders a numeric or budget-object diff value compactly and readably. */
function formatPayloadValue(value: ProposedChange['beforeValue']): string {
  if (value === undefined || value === null) return 'Default';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  return Object.entries(value)
    .map(([key, entryValue]) => `${key}: ${Math.round(entryValue).toLocaleString()}`)
    .join(', ');
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
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={`Review & Apply AI Proposals (${pendingProposals.length} Pending)`}
      description="Inspect calculated trade-offs and diffs before applying to your workspace"
      maxWidthClassName="max-w-2xl"
      headerClassName="bg-gradient-to-r from-amber-700 via-rose-900 to-purple-900 text-white"
      bodyClassName="p-6 max-h-[60vh] overflow-y-auto space-y-4"
      footer={
        <>
          <button
            onClick={onClose}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
          {pendingProposals.length > 0 && (
            <button
              onClick={onApplyAll}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-900 to-rose-900 hover:from-purple-950 hover:to-rose-950 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>Apply All ({pendingProposals.length}) Changes</span>
            </button>
          )}
        </>
      }
    >
      <h4 className="sr-only">Pending proposals</h4>
      {pendingProposals.length === 0 ? (
        <div className="text-center py-8">
          <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800">No Pending Proposals</p>
          <p className="text-xs text-slate-600 mt-1">
            All recommendations and constraint trade-offs have already been applied or dismissed.
          </p>
        </div>
      ) : (
        <ul className="space-y-4 list-none" aria-label="Pending proposals">
          {pendingProposals.map((prop) => (
            <li
              key={prop.id}
              className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                  Section: {prop.section}
                </span>
                <span className="text-[10px] text-slate-600">
                  {new Date(prop.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div>
                <h5 className="text-sm font-bold text-slate-900">{prop.title}</h5>
                <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                  {prop.description}
                </p>
              </div>

              {/* Diff Comparison if available */}
              {(prop.beforeValue !== undefined || prop.afterValue !== undefined) && (
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-600 block uppercase font-medium">
                      Current Value
                    </span>
                    <span className="text-slate-800 font-medium">
                      {formatPayloadValue(prop.beforeValue)}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-purple-700 shrink-0 mx-2" aria-hidden="true" />
                  <div className="text-right">
                    <span className="text-[10px] text-purple-800 block uppercase font-bold">
                      Proposed Update
                    </span>
                    <span className="text-purple-950 font-bold">
                      {formatPayloadValue(prop.afterValue)}
                    </span>
                  </div>
                </div>
              )}

              {/* Single Proposal Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => onRejectSingle(prop.id)}
                  className="text-xs px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                >
                  Decline
                </button>
                <button
                  onClick={() => onApplySingle(prop.id)}
                  className="flex items-center gap-1 text-xs px-3 py-1 font-semibold text-white bg-purple-900 hover:bg-purple-950 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Apply This Change</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-2 border-t border-amber-100">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        Every applied change is validated and mirrored into your proposals history for audit.
      </p>
    </ModalShell>
  );
};
