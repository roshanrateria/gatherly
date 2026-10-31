import React, { useState } from 'react';
import {
  Lightbulb,
  Sparkles,
  Plus,
  Bookmark,
  BookmarkCheck,
  X,
  RefreshCw,
  Check,
  Tag,
  DollarSign,
  Layers,
} from 'lucide-react';
import { AppState, Idea, IdeaCategory, IdeaCostTier } from '../../types/index';
import { getDefaultIdeasForEvent } from '../../lib/creativeIdeas';

interface IdeasTabProps {
  state: AppState;
  onUpdateState: (newState: AppState) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg?: string) => void;
}

export const IdeasTab: React.FC<IdeasTabProps> = ({ state, onUpdateState, onShowToast }) => {
  const { ideas, event } = state;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [iTitle, setITitle] = useState('');
  const [iCategory, setICategory] = useState<IdeaCategory>('theme');
  const [iDesc, setIDesc] = useState('');
  const [iFit, setIFit] = useState('');
  const [iTier, setITier] = useState<IdeaCostTier>('medium');
  const [iRequirements, setIRequirements] = useState('');

  const filteredIdeas = ideas.filter((idea) => {
    if (selectedCategory !== 'all' && idea.category !== selectedCategory) return false;
    return true;
  });

  const toggleSaveIdea = (ideaId: string) => {
    const updated = ideas.map((i) =>
      i.id === ideaId
        ? { ...i, status: (i.status === 'saved' ? 'suggested' : 'saved') as any }
        : i
    );
    onUpdateState({ ...state, ideas: updated });
    onShowToast('success', 'Idea Status Updated');
  };

  const rejectIdea = (ideaId: string) => {
    const updated = ideas.map((i) => (i.id === ideaId ? { ...i, status: 'rejected' as const } : i));
    onUpdateState({ ...state, ideas: updated });
    onShowToast('info', 'Idea Dismissed');
  };

  const handleRegenerateIdeas = () => {
    const freshIdeas = getDefaultIdeasForEvent(event.type);
    onUpdateState({ ...state, ideas: freshIdeas });
    onShowToast('success', 'Creative Bank Regenerated', 'Loaded fresh inspirations for your event.');
  };

  const handleSaveCustomIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!iTitle.trim()) return;

    const reqList = iRequirements
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const newIdea: Idea = {
      id: `idea_${Date.now()}`,
      category: iCategory,
      title: iTitle,
      description: iDesc,
      fitExplanation: iFit || 'Custom host inspiration tailored to guest preferences.',
      estimatedCostTier: iTier,
      requirements: reqList,
      status: 'saved',
      tags: ['Custom', event.type],
    };

    onUpdateState({ ...state, ideas: [...ideas, newIdea] });
    setIdeaModalOpen(false);
    setITitle('');
    setIDesc('');
    setIFit('');
    setIRequirements('');
    onShowToast('success', 'Custom Concept Added to Plan', iTitle);
  };

  const costTierLabels: Record<IdeaCostTier, { label: string; color: string }> = {
    low: { label: '$ (Budget-Friendly)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    medium: { label: '$$ (Balanced)', color: 'text-blue-700 bg-blue-50 border-blue-200' },
    high: { label: '$$$ (Elevated)', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    luxury: { label: '$$$$ (Opulent)', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-editorial text-slate-900">
            Creative Ideas &amp; Concept Studio
          </h2>
          <p className="text-xs text-slate-500">
            Personalized themes, decor blueprints, live menus, entertainment acts and gift concepts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerateIdeas}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-900" />
            <span>Regenerate Ideas</span>
          </button>

          <button
            onClick={() => setIdeaModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-purple-900 hover:bg-purple-950 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" />
            <span>Add Custom Idea</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        {[
          ['all', 'All Inspirations'],
          ['theme', 'Themes & Styling'],
          ['menu', 'Menus & Cocktails'],
          ['entertainment', 'Entertainment & DJ'],
          ['activity', 'Interactive Activities'],
          ['gift', 'Favors & Keepsakes'],
          ['photo_concept', 'Photo & Video Concepts'],
        ].map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setSelectedCategory(val)}
            className={`shrink-0 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              selectedCategory === val
                ? 'bg-purple-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Ideas Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredIdeas.map((idea) => {
          const isSaved = idea.status === 'saved';
          const tier = costTierLabels[idea.estimatedCostTier] || costTierLabels.medium;

          return (
            <div
              key={idea.id}
              className={`p-5 rounded-2xl border transition-all ${
                isSaved
                  ? 'bg-purple-50/30 border-purple-300 ring-2 ring-purple-900/10'
                  : 'bg-white border-slate-200 shadow-2xs hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-900">
                      {idea.category.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${tier.color}`}>
                      {tier.label}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 pt-1">{idea.title}</h3>
                </div>

                <button
                  onClick={() => toggleSaveIdea(idea.id)}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    isSaved
                      ? 'bg-purple-900 text-amber-300'
                      : 'bg-slate-100 text-slate-400 hover:text-purple-900 hover:bg-purple-50'
                  }`}
                  title={isSaved ? 'Saved in Plan' : 'Save to Plan'}
                >
                  {isSaved ? (
                    <BookmarkCheck className="w-5 h-5" />
                  ) : (
                    <Bookmark className="w-5 h-5" />
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">{idea.description}</p>

              {/* Fit Explanation */}
              {idea.fitExplanation && (
                <div className="my-3 p-3 rounded-xl bg-[#FAF8F5] border border-[#E7E0D6] text-xs">
                  <span className="font-bold text-purple-950 block mb-0.5">
                    Why it fits your celebration:
                  </span>
                  <p className="text-slate-700 leading-relaxed">{idea.fitExplanation}</p>
                </div>
              )}

              {/* Requirements Checklist */}
              {idea.requirements && idea.requirements.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Execution Requirements
                  </span>
                  <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                    {idea.requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap gap-1">
                  {idea.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500"
                    >
                      #{t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {idea.status !== 'rejected' && (
                    <button
                      onClick={() => rejectIdea(idea.id)}
                      className="text-slate-400 hover:text-rose-600 font-medium"
                    >
                      Dismiss
                    </button>
                  )}
                  <button
                    onClick={() => toggleSaveIdea(idea.id)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      isSaved
                        ? 'bg-purple-100 text-purple-900 border border-purple-200'
                        : 'bg-purple-900 text-white hover:bg-purple-950'
                    }`}
                  >
                    {isSaved ? '✓ Saved to Plan' : 'Save Concept'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom Idea Modal */}
      {ideaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveCustomIdea}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95"
          >
            <h3 className="text-base font-bold text-slate-900 font-editorial">
              Add Custom Creative Concept
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Concept Title</label>
              <input
                type="text"
                required
                value={iTitle}
                onChange={(e) => setITitle(e.target.value)}
                placeholder="e.g. Polaroid Vintage Wishing Tree"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={iCategory}
                  onChange={(e) => setICategory(e.target.value as IdeaCategory)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
                >
                  <option value="theme">Theme &amp; Styling</option>
                  <option value="menu">Menu &amp; Cocktails</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="activity">Activity</option>
                  <option value="gift">Gifts &amp; Favors</option>
                  <option value="photo_concept">Photo Concept</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Budget Impact
                </label>
                <select
                  value={iTier}
                  onChange={(e) => setITier(e.target.value as IdeaCostTier)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
                >
                  <option value="low">$ (Low Impact)</option>
                  <option value="medium">$$ (Moderate Impact)</option>
                  <option value="high">$$$ (High Impact)</option>
                  <option value="luxury">$$$$ (Luxury Element)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                required
                value={iDesc}
                onChange={(e) => setIDesc(e.target.value)}
                placeholder="Describe the experience..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Execution Requirements (One per line)
              </label>
              <textarea
                rows={2}
                value={iRequirements}
                onChange={(e) => setIRequirements(e.target.value)}
                placeholder="2 Instax cameras&#10;Wooden tree structure&#10;Metallic ink pens"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIdeaModalOpen(false)}
                className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-900 text-white rounded-lg text-xs font-bold hover:bg-purple-950 transition-colors cursor-pointer"
              >
                Save Concept
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
