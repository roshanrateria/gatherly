import React, { useState } from 'react';
import {
  Plus,
  DollarSign,
  Sparkles,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AppState, BudgetCategory, Expense, PriorityTier, PaymentStatus } from '../../types/index';
import {
  calculateBudgetSummary,
  calculateCategoryBreakdowns,
  generateSavingsTradeOffs,
  SavingsRecommendation,
} from '../../lib/deterministicBudget';
import { formatCurrency } from '../../lib/currency';
import { budgetBasisGuestCount } from '../../lib/guestMetrics';
import { createId } from '../../lib/createId';
import { ModalShell } from '../ui/ModalShell';

interface BudgetTabProps {
  state: AppState;
  onUpdateState: (newState: AppState) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg?: string) => void;
}

export const BudgetTab: React.FC<BudgetTabProps> = ({ state, onUpdateState, onShowToast }) => {
  const { event, categories, expenses } = state;
  const currency = event.budget.currency;
  const numFormat = event.budget.numberFormat;

  const [savingsModalOpen, setSavingsModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // New Category Form
  const [catName, setCatName] = useState('');
  const [catPercent, setCatPercent] = useState<number>(10);
  const [catPriority, setCatPriority] = useState<PriorityTier>('medium');
  const [catDesc, setCatDesc] = useState('');

  // New Expense Form
  const [expTitle, setExpTitle] = useState('');
  const [expCatId, setExpCatId] = useState(categories[0]?.id || '');
  const [expEst, setExpEst] = useState<number>(0);
  const [expAct, setExpAct] = useState<number>(0);
  const [expPaid, setExpPaid] = useState<number>(0);
  const [expNotes, setExpNotes] = useState('');

  const guestBasis = budgetBasisGuestCount(state);
  const summary = calculateBudgetSummary(
    event.budget.total,
    categories,
    expenses,
    guestBasis
  );

  const breakdowns = calculateCategoryBreakdowns(categories, expenses);
  const savingsSuggestions = generateSavingsTradeOffs(
    summary.overrunAmount || Math.max(0, summary.totalEstimated - summary.totalBudget),
    categories,
    event.priorities
  );

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    const allocatedAmount = Math.round((event.budget.total * catPercent) / 100);

    if (editingCategory) {
      const updated = categories.map((c) =>
        c.id === editingCategory.id
          ? {
              ...c,
              name: catName,
              allocationPercent: catPercent,
              allocatedAmount,
              priority: catPriority,
              description: catDesc,
            }
          : c
      );
      onUpdateState({ ...state, categories: updated });
      onShowToast('success', 'Category Updated', catName);
    } else {
      const newCat: BudgetCategory = {
        id: createId('cat'),
        name: catName,
        allocationPercent: catPercent,
        allocatedAmount,
        priority: catPriority,
        description: catDesc,
        isCustom: true,
      };
      onUpdateState({ ...state, categories: [...categories, newCat] });
      onShowToast('success', 'Category Created', catName);
    }

    setCategoryModalOpen(false);
    setEditingCategory(null);
    setCatName('');
  };

  const handleDeleteCategory = (catId: string) => {
    if (window.confirm('Delete this budget category and all linked expenses?')) {
      const updatedCats = categories.filter((c) => c.id !== catId);
      const updatedExpenses = expenses.filter((e) => e.categoryId !== catId);
      onUpdateState({ ...state, categories: updatedCats, expenses: updatedExpenses });
      onShowToast('info', 'Category Deleted');
    }
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !expCatId) return;

    const paymentStatus: PaymentStatus =
      expPaid >= expAct && expAct > 0
        ? 'paid_in_full'
        : expPaid > 0
        ? 'partially_paid'
        : 'unpaid';

    if (editingExpense) {
      const updated = expenses.map((exp) =>
        exp.id === editingExpense.id
          ? {
              ...exp,
              categoryId: expCatId,
              title: expTitle,
              estimatedCost: expEst,
              actualCost: expAct,
              paidAmount: expPaid,
              paymentStatus,
              notes: expNotes,
            }
          : exp
      );
      onUpdateState({ ...state, expenses: updated });
      onShowToast('success', 'Expense Updated', expTitle);
    } else {
      const newExp: Expense = {
        id: createId('exp'),
        categoryId: expCatId,
        title: expTitle,
        estimatedCost: expEst,
        actualCost: expAct,
        paidAmount: expPaid,
        paymentStatus,
        notes: expNotes,
      };
      onUpdateState({ ...state, expenses: [...expenses, newExp] });
      onShowToast('success', 'Expense Recorded', expTitle);
    }

    setExpenseModalOpen(false);
    setEditingExpense(null);
    setExpTitle('');
    setExpEst(0);
    setExpAct(0);
    setExpPaid(0);
  };

  const handleDeleteExpense = (expId: string) => {
    onUpdateState({ ...state, expenses: expenses.filter((e) => e.id !== expId) });
    onShowToast('info', 'Expense Removed');
  };

  const applySavingsTradeOff = (rec: SavingsRecommendation) => {
    const updated = categories.map((c) =>
      c.id === rec.categoryId
        ? {
            ...c,
            allocatedAmount: rec.proposedAllocated,
            allocationPercent: Math.round((rec.proposedAllocated / event.budget.total) * 100),
          }
        : c
    );
    onUpdateState({ ...state, categories: updated });
    onShowToast(
      'success',
      'Savings Trade-Off Applied',
      `Saved ${formatCurrency(rec.savedAmount, currency, numFormat)} in ${rec.categoryName}`
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-600 block">Total Budget Target</span>
          <div className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            {formatCurrency(summary.totalBudget, currency, numFormat)}
          </div>
          <span className="text-[11px] text-slate-600 block mt-1">
            Allocated: {formatCurrency(summary.totalAllocated, currency, numFormat)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-600 block">Committed (Actual)</span>
          <div className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            {formatCurrency(summary.totalActual, currency, numFormat)}
          </div>
          <span className="text-[11px] text-slate-600 block mt-1">
            Estimated: {formatCurrency(summary.totalEstimated, currency, numFormat)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-600 block">Disbursed (Paid)</span>
          <div className="text-lg sm:text-xl font-bold text-emerald-700 mt-1">
            {formatCurrency(summary.totalPaid, currency, numFormat)}
          </div>
          <span className="text-[11px] text-slate-600 block mt-1">
            Pending: {formatCurrency(summary.pendingPayment, currency, numFormat)}
          </span>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-2xs ${
            summary.isOverrun
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <span className="text-xs opacity-75 block">
            {summary.isOverrun ? 'Projected Overrun' : 'Remaining Balance'}
          </span>
          <div className="text-lg sm:text-xl font-extrabold mt-1">
            {summary.isOverrun
              ? `+${formatCurrency(summary.overrunAmount, currency, numFormat)}`
              : formatCurrency(summary.remainingBalance, currency, numFormat)}
          </div>
          <span className="text-[11px] opacity-75 block mt-1">
            {summary.utilizationPercent}% of budget utilized
          </span>
        </div>
      </div>

      {/* Per-Guest Economics & Overrun Alert Banner */}
      <div className="bg-[#F8F5F0] border border-[#E6DEC9] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-900 text-amber-200 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Per-Guest Spend Metrics (Deterministic Application Arithmetic)
            </h4>
            <p className="text-xs text-slate-700 mt-0.5">
              Estimated: <strong>{formatCurrency(summary.perGuestEstimated, currency, numFormat)}</strong> /
              guest • Actual:{' '}
              <strong>{formatCurrency(summary.perGuestActual, currency, numFormat)}</strong> / guest
              (Calculated over {guestBasis} expected attendees)
            </p>
          </div>
        </div>

        {summary.isOverrun && (
          <button
            onClick={() => setSavingsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-200" aria-hidden="true" />
            <span>Suggest Savings ({savingsSuggestions.length} Trade-offs)</span>
          </button>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-slate-900 font-editorial">
            Event Budget Categories ({categories.length})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingCategory(null);
              setCatName('');
              setCatPercent(10);
              setCatPriority('medium');
              setCatDesc('');
              setCategoryModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-purple-900" aria-hidden="true" />
            <span>Add Category</span>
          </button>

          <button
            onClick={() => {
              setEditingExpense(null);
              setExpTitle('');
              setExpEst(0);
              setExpAct(0);
              setExpPaid(0);
              setExpCatId(categories[0]?.id || '');
              setExpenseModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-900 hover:bg-purple-950 text-white transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
            <span>Record Expense / Quote</span>
          </button>
        </div>
      </div>

      {/* Categories Table / Accordion */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[10px] tracking-wider">
                <th scope="col" className="py-3 px-4">Category & Priority</th>
                <th scope="col" className="py-3 px-4 text-right">Allocated</th>
                <th scope="col" className="py-3 px-4 text-right">Estimated</th>
                <th scope="col" className="py-3 px-4 text-right">Actual</th>
                <th scope="col" className="py-3 px-4 text-right">Paid</th>
                <th scope="col" className="py-3 px-4 text-right">Remaining</th>
                <th scope="col" className="py-3 px-4 text-center">Status</th>
                <th scope="col" className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {breakdowns.map((b) => {
                const cat = b.category;
                const isExpanded = expandedCategoryId === cat.id;
                const catExpenses = expenses.filter((e) => e.categoryId === cat.id);

                return (
                  <React.Fragment key={cat.id}>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setExpandedCategoryId(isExpanded ? null : cat.id)
                            }
                            className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} expenses for ${cat.name}`}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                          </button>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">
                              {cat.name}
                            </span>
                            <span className="text-[11px] text-slate-600 line-clamp-1">
                              {cat.description || 'Category budget bucket'}
                            </span>
                          </div>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                              cat.priority === 'must_have'
                                ? 'bg-purple-100 text-purple-900'
                                : cat.priority === 'high'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {cat.priority.replace('_', ' ')}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        {formatCurrency(b.allocatedAmount, currency, numFormat)}
                        <span className="text-[10px] text-slate-600 block font-normal">
                          {cat.allocationPercent}%
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right text-slate-700">
                        {formatCurrency(b.estimatedCost, currency, numFormat)}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(b.actualCost, currency, numFormat)}
                      </td>

                      <td className="py-3 px-4 text-right text-emerald-700 font-medium">
                        {formatCurrency(b.paidAmount, currency, numFormat)}
                      </td>

                      <td
                        className={`py-3 px-4 text-right font-semibold ${
                          b.remainingInCategory < 0 ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        {formatCurrency(b.remainingInCategory, currency, numFormat)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {b.isOverrun ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Overrun
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            On Track
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setCatName(cat.name);
                              setCatPercent(cat.allocationPercent);
                              setCatPriority(cat.priority);
                              setCatDesc(cat.description);
                              setCategoryModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                            aria-label={`Edit category ${cat.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 text-slate-500 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            aria-label={`Delete category ${cat.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Expenses Sub-rows */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={8} className="p-4 pl-12">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                Line Item Expenses for {cat.name} ({catExpenses.length})
                              </span>
                              <button
                                onClick={() => {
                                  setEditingExpense(null);
                                  setExpTitle('');
                                  setExpEst(0);
                                  setExpAct(0);
                                  setExpPaid(0);
                                  setExpCatId(cat.id);
                                  setExpenseModalOpen(true);
                                }}
                                className="text-xs text-purple-900 hover:text-purple-950 font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" aria-hidden="true" />
                                <span>Add Item</span>
                              </button>
                            </div>

                            {catExpenses.length === 0 ? (
                              <p className="text-xs text-slate-600 italic py-2">
                                No expenses recorded yet for this category. Click "Add Item" to log
                                vendor quotes or receipts.
                              </p>
                            ) : (
                              <ul className="space-y-1.5 list-none">
                                {catExpenses.map((exp) => (
                                  <li
                                    key={exp.id}
                                    className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <span className="font-semibold text-slate-900">
                                        {exp.title}
                                      </span>
                                      {exp.notes && (
                                        <p className="text-[11px] text-slate-600 mt-0.5">
                                          {exp.notes}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span className="text-slate-600 text-[11px]">
                                        Est: {formatCurrency(exp.estimatedCost, currency, numFormat)}
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        Actual:{' '}
                                        {formatCurrency(exp.actualCost, currency, numFormat)}
                                      </span>
                                      <span className="text-emerald-700 font-semibold">
                                        Paid: {formatCurrency(exp.paidAmount, currency, numFormat)}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                          exp.paymentStatus === 'paid_in_full'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : exp.paymentStatus === 'partially_paid'
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-slate-100 text-slate-800'
                                        }`}
                                      >
                                        {exp.paymentStatus.replace('_', ' ')}
                                      </span>
                                      <button
                                        onClick={() => handleDeleteExpense(exp.id)}
                                        className="text-slate-500 hover:text-rose-600 p-1 cursor-pointer"
                                        aria-label={`Delete expense ${exp.title}`}
                                      >
                                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Savings Recommendations Drawer / Modal */}
      <ModalShell
        isOpen={savingsModalOpen}
        onClose={() => setSavingsModalOpen(false)}
        title="Deterministic Savings Trade-Offs"
        maxWidthClassName="max-w-xl"
        bodyClassName="p-6 space-y-4"
        headerClassName="bg-gradient-to-r from-amber-600 to-rose-900 text-white"
      >
        <p className="text-xs text-slate-700 leading-relaxed">
          To eliminate the projected budget overrun without compromising your top priorities (
          <strong>{event.priorities.slice(0, 2).join(' & ')}</strong>), our deterministic
          optimizer suggests trimming the following flexible line items:
        </p>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {savingsSuggestions.length === 0 && (
            <p className="text-xs text-slate-600">No further trimmable line items were found.</p>
          )}
          {savingsSuggestions.map((rec) => (
            <div
              key={rec.categoryId}
              className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{rec.categoryName}</span>
                <span className="text-emerald-700 font-bold">
                  Save {formatCurrency(rec.savedAmount, currency, numFormat)}
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed">{rec.reason}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600 text-[11px]">
                  {formatCurrency(rec.currentAllocated, currency, numFormat)} →{' '}
                  {formatCurrency(rec.proposedAllocated, currency, numFormat)}
                </span>
                <button
                  onClick={() => applySavingsTradeOff(rec)}
                  className="px-3 py-1 bg-purple-900 hover:bg-purple-950 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Apply Trade-Off
                </button>
              </div>
            </div>
          ))}
        </div>
      </ModalShell>

      {/* Category Modal */}
      <ModalShell
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Budget Category' : 'Create Custom Budget Category'}
        maxWidthClassName="max-w-md"
        bodyClassName="p-6"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div>
            <label htmlFor="category-name" className="block text-xs font-medium text-slate-800 mb-1">
              Category Name
            </label>
            <input
              id="category-name"
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Traditional Band & Turban Styling"
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="category-percent" className="block text-xs font-medium text-slate-800 mb-1">
                Allocation %
              </label>
              <input
                id="category-percent"
                type="number"
                min="1"
                max="100"
                value={catPercent}
                onChange={(e) => setCatPercent(parseInt(e.target.value) || 1)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="category-priority" className="block text-xs font-medium text-slate-800 mb-1">
                Priority
              </label>
              <select
                id="category-priority"
                value={catPriority}
                onChange={(e) => setCatPriority(e.target.value as PriorityTier)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
              >
                <option value="must_have">Must-Have</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="category-description" className="block text-xs font-medium text-slate-800 mb-1">
              Description
            </label>
            <textarea
              id="category-description"
              rows={2}
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="Deliverables and scope notes..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCategoryModalOpen(false)}
              className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-900 text-white rounded-lg text-xs font-bold hover:bg-purple-950 transition-colors cursor-pointer"
            >
              Save Category
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Expense Modal */}
      <ModalShell
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title={editingExpense ? 'Edit Expense Item' : 'Record New Expense or Quote'}
        maxWidthClassName="max-w-md"
        bodyClassName="p-6"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div>
            <label htmlFor="expense-category" className="block text-xs font-medium text-slate-800 mb-1">
              Category
            </label>
            <select
              id="expense-category"
              value={expCatId}
              onChange={(e) => setExpCatId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="expense-title" className="block text-xs font-medium text-slate-800 mb-1">
              Item Title / Vendor Name
            </label>
            <input
              id="expense-title"
              type="text"
              required
              value={expTitle}
              onChange={(e) => setExpTitle(e.target.value)}
              placeholder="e.g. Lawn Advance Deposit"
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="expense-estimated" className="block text-xs font-medium text-slate-800 mb-1">
                Estimated
              </label>
              <input
                id="expense-estimated"
                type="number"
                min="0"
                value={expEst}
                onChange={(e) => setExpEst(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="expense-actual" className="block text-xs font-medium text-slate-800 mb-1">
                Actual
              </label>
              <input
                id="expense-actual"
                type="number"
                min="0"
                value={expAct}
                onChange={(e) => setExpAct(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="expense-paid" className="block text-xs font-medium text-slate-800 mb-1">
                Paid
              </label>
              <input
                id="expense-paid"
                type="number"
                min="0"
                value={expPaid}
                onChange={(e) => setExpPaid(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label htmlFor="expense-notes" className="block text-xs font-medium text-slate-800 mb-1">
              Notes
            </label>
            <textarea
              id="expense-notes"
              rows={2}
              value={expNotes}
              onChange={(e) => setExpNotes(e.target.value)}
              placeholder="Contract payment milestones, receipt references..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setExpenseModalOpen(false)}
              className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-900 text-white rounded-lg text-xs font-bold hover:bg-purple-950 transition-colors cursor-pointer"
            >
              Save Expense
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
};
