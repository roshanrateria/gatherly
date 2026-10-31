import React, { useState } from 'react';
import {
  Clock,
  Plus,
  AlertTriangle,
  Download,
  Printer,
  Edit2,
  Trash2,
  MapPin,
  User,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { AppState, ScheduleItem, ScheduleCategory } from '../../types/index';
import { detectScheduleConflicts } from '../../lib/deterministicSchedule';
import { generateScheduleIcs, downloadIcsFile } from '../../lib/icsExport';

interface ScheduleTabProps {
  state: AppState;
  onUpdateState: (newState: AppState) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg?: string) => void;
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({ state, onUpdateState, onShowToast }) => {
  const { schedule, event } = state;
  const [selectedDay, setSelectedDay] = useState<number>(1);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // Form State
  const [sTitle, setSTitle] = useState('');
  const [sCategory, setSCategory] = useState<ScheduleCategory>('ceremony');
  const [sStartTime, setSStartTime] = useState('18:00');
  const [sEndTime, setSEndTime] = useState('19:30');
  const [sLocation, setSLocation] = useState('Main Lawn');
  const [sOwner, setSOwner] = useState('Event Lead');
  const [sNotes, setSNotes] = useState('');

  const conflicts = detectScheduleConflicts(schedule);

  // Filter for selected day
  const dayItems = schedule
    .filter((item) => item.dayNumber === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const dayConflicts = conflicts.filter((c) =>
    dayItems.some((item) => c.itemIds.includes(item.id))
  );

  const calculateDurationMins = (start: string, end: string): number => {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(15, diff > 0 ? diff : diff + 24 * 60);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sTitle.trim()) return;

    const durationMinutes = calculateDurationMins(sStartTime, sEndTime);

    // Compute date for this day
    const d = new Date(event.startDate);
    d.setDate(d.getDate() + (selectedDay - 1));
    const itemDate = d.toISOString().split('T')[0];

    if (editingItem) {
      const updated = schedule.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              title: sTitle,
              category: sCategory,
              startTime: sStartTime,
              endTime: sEndTime,
              durationMinutes,
              location: sLocation,
              owner: sOwner,
              notes: sNotes,
            }
          : item
      );
      onUpdateState({ ...state, schedule: updated });
      onShowToast('success', 'Activity Updated', sTitle);
    } else {
      const newItem: ScheduleItem = {
        id: `sch_${Date.now()}`,
        dayNumber: selectedDay,
        date: itemDate,
        startTime: sStartTime,
        endTime: sEndTime,
        durationMinutes,
        title: sTitle,
        category: sCategory,
        location: sLocation,
        owner: sOwner,
        notes: sNotes,
      };
      onUpdateState({ ...state, schedule: [...schedule, newItem] });
      onShowToast('success', 'Activity Added to Run Sheet', sTitle);
    }

    setItemModalOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (itemId: string) => {
    onUpdateState({ ...state, schedule: schedule.filter((i) => i.id !== itemId) });
    onShowToast('info', 'Activity Removed');
  };

  const handleExportScheduleIcs = () => {
    const icsContent = generateScheduleIcs(schedule, event.title);
    downloadIcsFile(icsContent, `${event.title.replace(/\s+/g, '_')}_run_sheet.ics`);
    onShowToast('success', 'Run Sheet Exported to .ICS');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-editorial text-slate-900">
            Event-Day Run Sheet &amp; Master Schedule
          </h2>
          <p className="text-xs text-slate-500">
            Real-time chronological agenda with conflict detection, setup verification, and transit
            buffer alerts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Sheet</span>
          </button>

          <button
            onClick={handleExportScheduleIcs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-700" />
            <span>Export .ICS</span>
          </button>

          <button
            onClick={() => {
              setEditingItem(null);
              setSTitle('');
              setSCategory('ceremony');
              setSStartTime('17:00');
              setSEndTime('18:30');
              setSLocation(event.location.venueName || 'Main Lawn');
              setSOwner('Host');
              setSNotes('');
              setItemModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-purple-900 hover:bg-purple-950 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" />
            <span>Add Activity</span>
          </button>
        </div>
      </div>

      {/* Multi-Day Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {Array.from({ length: event.durationDays }).map((_, idx) => {
          const dayNum = idx + 1;
          const d = new Date(event.startDate);
          d.setDate(d.getDate() + idx);
          const dateStr = d.toISOString().split('T')[0];

          return (
            <button
              key={dayNum}
              onClick={() => setSelectedDay(dayNum)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDay === dayNum
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Day {dayNum} ({dateStr})
            </button>
          );
        })}
      </div>

      {/* Conflict Alert Banner if any conflict on this day */}
      {dayConflicts.length > 0 && (
        <div className="space-y-2">
          {dayConflicts.map((c) => (
            <div
              key={c.id}
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                c.severity === 'critical'
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : c.severity === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-blue-50 border-blue-200 text-blue-950'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  c.severity === 'critical'
                    ? 'text-rose-600'
                    : c.severity === 'warning'
                    ? 'text-amber-600'
                    : 'text-blue-600'
                }`}
              />
              <div>
                <strong className="font-bold block uppercase text-[10px] tracking-wider">
                  {c.type.replace('_', ' ')} Warning ({c.severity})
                </strong>
                <p className="mt-0.5 leading-relaxed">{c.description}</p>
                <span className="font-semibold block mt-1 opacity-90">
                  Recommendation: {c.suggestion}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chronological Activities List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {dayItems.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">No activities scheduled for Day {selectedDay}</h4>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;Add Activity&quot; to build this day&apos;s run sheet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dayItems.map((item) => (
              <div
                key={item.id}
                className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                {/* Time & Title */}
                <div className="flex items-start gap-4">
                  <div className="min-w-[100px] text-left">
                    <span className="text-sm font-extrabold text-purple-950 block">
                      {item.startTime} - {item.endTime}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {item.durationMinutes} mins
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{item.title}</span>
                      <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-purple-100 text-purple-900 uppercase">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {item.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Lead: {item.owner}
                      </span>
                    </div>

                    {item.notes && (
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.notes}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setSTitle(item.title);
                      setSCategory(item.category);
                      setSStartTime(item.startTime);
                      setSEndTime(item.endTime);
                      setSLocation(item.location);
                      setSOwner(item.owner);
                      setSNotes(item.notes || '');
                      setItemModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Add / Edit Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveItem}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95"
          >
            <h3 className="text-base font-bold text-slate-900 font-editorial">
              {editingItem ? 'Edit Run Sheet Activity' : `Add Activity for Day ${selectedDay}`}
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Activity Name</label>
              <input
                type="text"
                required
                value={sTitle}
                onChange={(e) => setSTitle(e.target.value)}
                placeholder="e.g. Sangeet Grand Entry & Family Toasts"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={sStartTime}
                  onChange={(e) => setSStartTime(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">End Time</label>
                <input
                  type="time"
                  required
                  value={sEndTime}
                  onChange={(e) => setSEndTime(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={sCategory}
                  onChange={(e) => setSCategory(e.target.value as ScheduleCategory)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
                >
                  <option value="ceremony">Ceremony</option>
                  <option value="meal">Meal / Banquet</option>
                  <option value="setup">Setup &amp; Soundcheck</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="speech">Speeches &amp; Toasts</option>
                  <option value="photo_session">Photo Session</option>
                  <option value="transition">Transit Buffer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Lead Owner</label>
                <input
                  type="text"
                  value={sOwner}
                  onChange={(e) => setSOwner(e.target.value)}
                  placeholder="e.g. Stage Manager / Emcee"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Location / Zone
              </label>
              <input
                type="text"
                value={sLocation}
                onChange={(e) => setSLocation(e.target.value)}
                placeholder="e.g. Lawn 1 or Crystal Ballroom"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Cues &amp; Notes</label>
              <textarea
                rows={2}
                value={sNotes}
                onChange={(e) => setSNotes(e.target.value)}
                placeholder="Microphone requirements, lighting cues, entrance song..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-900 text-white rounded-lg text-xs font-bold hover:bg-purple-950 transition-colors cursor-pointer"
              >
                Save Activity
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
