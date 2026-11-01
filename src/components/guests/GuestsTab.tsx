import React, { useState } from 'react';
import {
  Plus,
  Upload,
  Download,
  Search,
  Edit2,
  Trash2,
  Utensils,
} from 'lucide-react';
import {
  AppState,
  Guest,
  GuestGroup,
  RsvpStatus,
  DietaryNeed,
  AccessibilityNeed,
} from '../../types/index';
import { computeGuestMetrics } from '../../lib/guestMetrics';
import { parseGuestsCsv, guestsToCsv } from '../../lib/csv';
import { describeError } from '../../lib/aiService';
import { createId } from '../../lib/createId';
import { ModalShell } from '../ui/ModalShell';

interface GuestsTabProps {
  state: AppState;
  onUpdateState: (newState: AppState) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg?: string) => void;
}

export const GuestsTab: React.FC<GuestsTabProps> = ({ state, onUpdateState, onShowToast }) => {
  const { guests, event } = state;

  const [searchQuery, setSearchQuery] = useState('');
  const [rsvpFilter, setRsvpFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');

  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvInput, setCsvInput] = useState('');

  // Form State
  const [gName, setGName] = useState('');
  const [gGroup, setGGroup] = useState<GuestGroup>('family');
  const [gRsvp, setGRsvp] = useState<RsvpStatus>('pending');
  const [gPlusOnes, setGPlusOnes] = useState<number>(0);
  const [gPhone, setGPhone] = useState('');
  const [gEmail, setGEmail] = useState('');
  const [gDietary, setGDietary] = useState<DietaryNeed[]>(['veg']);
  const [gAccessibility, setGAccessibility] = useState<AccessibilityNeed[]>(['none']);
  const [gTable, setGTable] = useState('');
  const [gNotes, setGNotes] = useState('');

  // Attendance metrics (single source of truth for headcount arithmetic)
  const metrics = computeGuestMetrics(guests);
  const attendingGuests = guests.filter((g) => g.rsvpStatus === 'attending');
  const tentativeGuests = guests.filter((g) => g.rsvpStatus === 'tentative');
  const pendingEntries = guests.filter((g) => g.rsvpStatus === 'pending');

  // Dietary counts
  const dietaryCounts: Record<string, number> = {};
  guests.forEach((g) => {
    if (g.rsvpStatus === 'attending' || g.rsvpStatus === 'tentative') {
      const multiplier = 1 + (g.plusOnes || 0);
      g.dietaryNeeds.forEach((d) => {
        dietaryCounts[d] = (dietaryCounts[d] || 0) + multiplier;
      });
    }
  });

  // Filtered list
  const filteredGuests = guests.filter((g) => {
    if (rsvpFilter !== 'all' && g.rsvpStatus !== rsvpFilter) return false;
    if (groupFilter !== 'all' && g.group !== groupFilter) return false;
    if (
      searchQuery.trim() &&
      !g.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(g.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleSaveGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gName.trim()) return;

    if (editingGuest) {
      const updated = guests.map((g) =>
        g.id === editingGuest.id
          ? {
              ...g,
              name: gName,
              group: gGroup,
              rsvpStatus: gRsvp,
              plusOnes: gPlusOnes,
              phone: gPhone,
              email: gEmail,
              dietaryNeeds: gDietary,
              accessibilityNeeds: gAccessibility,
              tableNumber: gTable,
              notes: gNotes,
            }
          : g
      );
      onUpdateState({ ...state, guests: updated });
      onShowToast('success', 'Guest Updated', gName);
    } else {
      const newGuest: Guest = {
        id: createId('g'),
        name: gName,
        group: gGroup,
        rsvpStatus: gRsvp,
        plusOnes: gPlusOnes,
        phone: gPhone,
        email: gEmail,
        dietaryNeeds: gDietary,
        accessibilityNeeds: gAccessibility,
        tableNumber: gTable,
        notes: gNotes,
      };
      onUpdateState({ ...state, guests: [...guests, newGuest] });
      onShowToast('success', 'Guest Added', gName);
    }

    setGuestModalOpen(false);
    setEditingGuest(null);
  };

  const handleDeleteGuest = (guestId: string) => {
    onUpdateState({ ...state, guests: guests.filter((g) => g.id !== guestId) });
    onShowToast('info', 'Guest Removed');
  };

  /** Downloads a formula-safe, RFC 4180 encoded CSV. */
  const handleExportCsv = () => {
    const csvContent = guestsToCsv(guests);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/\s+/g, '_')}_guest_list.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast('success', 'Guest List Exported to CSV');
  };

  /**
   * Imports guests from pasted CSV through the shared parser, which validates
   * enum fields and caps row/cell sizes instead of trusting raw input.
   */
  const handleImportCsv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvInput.trim()) return;

    try {
      const { guests: imported, errors } = parseGuestsCsv(csvInput, {
        idFactory: () => createId('g_imp'),
      });

      if (imported.length === 0) {
        const firstError = errors[0] || 'No guest rows could be parsed.';
        onShowToast('error', 'CSV Import Failed', firstError);
        return;
      }

      onUpdateState({ ...state, guests: [...guests, ...imported] });
      setCsvModalOpen(false);
      setCsvInput('');
      onShowToast(
        errors.length > 0 ? 'warning' : 'success',
        'CSV Import Complete',
        `Added ${imported.length} guests.${errors.length > 0 ? ` ${errors.length} row(s) skipped: ${errors[0]}` : ''}`
      );
    } catch (err: unknown) {
      onShowToast('error', 'CSV Import Error', describeError(err));
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-editorial text-slate-900">
            Guest List, RSVP Registry & Hospitality
          </h2>
          <p className="text-xs text-slate-600">
            Track headcounts, plus-ones, meal requirements, and accessibility arrangements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCsvModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-purple-900" aria-hidden="true" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-700" aria-hidden="true" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setEditingGuest(null);
              setGName('');
              setGGroup('family');
              setGRsvp('pending');
              setGPlusOnes(0);
              setGPhone('');
              setGEmail('');
              setGDietary(['veg']);
              setGAccessibility(['none']);
              setGTable('');
              setGNotes('');
              setGuestModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-purple-900 hover:bg-purple-950 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
            <span>Add Guest</span>
          </button>
        </div>
      </div>

      {/* Attendance KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-600 block">Total Invited</span>
          <span className="text-lg font-bold text-slate-900 block mt-0.5">
            {metrics.invitedHeadcount} Pax
          </span>
          <span className="text-[10px] text-slate-600">
            {guests.length} entries • Target: {event.guests.count}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-emerald-700 font-semibold block">Confirmed Attending</span>
          <span className="text-lg font-bold text-emerald-800 block mt-0.5">
            {metrics.confirmedHeadcount} Pax
          </span>
          <span className="text-[10px] text-slate-600">{attendingGuests.length} parties</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-amber-700 font-semibold block">Tentative</span>
          <span className="text-lg font-bold text-amber-800 block mt-0.5">
            {metrics.tentativeHeadcount} Pax
          </span>
          <span className="text-[10px] text-slate-600">{tentativeGuests.length} parties</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-600 block">Pending RSVP</span>
          <span className="text-lg font-bold text-slate-700 block mt-0.5">
            {pendingEntries.length}
          </span>
          <span className="text-[10px] text-slate-600">Follow-up needed</span>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 shadow-2xs">
          <span className="text-[11px] text-purple-900 font-bold block">
            Expected Attendance
          </span>
          <span className="text-lg font-extrabold text-purple-950 block mt-0.5">
            {metrics.expectedAttendance > 0 ? metrics.expectedAttendance : event.guests.expectedAttendance} Pax
          </span>
          <span className="text-[10px] text-purple-900">Confirmed + 50% of tentative</span>
        </div>
      </div>

      {/* Dietary & Accessibility Breakdown Badges */}
      <div className="bg-[#FAF7F2] border border-[#E7E0D6] p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Utensils className="w-4 h-4 text-purple-900" aria-hidden="true" />
            Dietary Portions:
          </span>
          {Object.keys(dietaryCounts).length === 0 ? (
            <span className="text-slate-600 italic">No specific preferences recorded yet</span>
          ) : (
            Object.entries(dietaryCounts).map(([diet, count]) => (
              <span
                key={diet}
                className="px-2.5 py-0.5 rounded-full bg-white border border-slate-300 font-semibold text-slate-800"
              >
                {diet.toUpperCase()}: {count}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" aria-hidden="true" />
          <label htmlFor="guest-search" className="sr-only">Search by guest name or notes</label>
          <input
            id="guest-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by guest name or notes..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg outline-hidden text-xs text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="guest-rsvp-filter" className="sr-only">Filter by RSVP status</label>
          <select
            id="guest-rsvp-filter"
            value={rsvpFilter}
            onChange={(e) => setRsvpFilter(e.target.value)}
            className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-medium"
          >
            <option value="all">All RSVPs</option>
            <option value="attending">Attending</option>
            <option value="tentative">Tentative</option>
            <option value="pending">Pending</option>
            <option value="declined">Declined</option>
          </select>

          <label htmlFor="guest-group-filter" className="sr-only">Filter by group</label>
          <select
            id="guest-group-filter"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-medium"
          >
            <option value="all">All Groups</option>
            <option value="family">Family</option>
            <option value="friends">Friends</option>
            <option value="colleagues">Colleagues</option>
            <option value="vip">VIP</option>
            <option value="bride_side">Bride Side</option>
            <option value="groom_side">Groom Side</option>
          </select>
        </div>
      </div>

      {/* Guests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[10px] tracking-wider">
              <th scope="col" className="py-3 px-4">Guest Name & Contact</th>
              <th scope="col" className="py-3 px-4">Group</th>
              <th scope="col" className="py-3 px-4 text-center">RSVP</th>
              <th scope="col" className="py-3 px-4 text-center">Plus Ones</th>
              <th scope="col" className="py-3 px-4">Dietary</th>
              <th scope="col" className="py-3 px-4">Accessibility</th>
              <th scope="col" className="py-3 px-4">Table</th>
              <th scope="col" className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredGuests.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-bold text-slate-900 block">{g.name}</span>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-0.5">
                    {g.phone && <span>{g.phone}</span>}
                    {g.email && <span>{g.email}</span>}
                  </div>
                </td>

                <td className="py-3 px-4 capitalize font-medium text-slate-700">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                    {g.group.replace('_', ' ')}
                  </span>
                </td>

                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      g.rsvpStatus === 'attending'
                        ? 'bg-emerald-100 text-emerald-800'
                        : g.rsvpStatus === 'tentative'
                        ? 'bg-amber-100 text-amber-800'
                        : g.rsvpStatus === 'declined'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {g.rsvpStatus}
                  </span>
                </td>

                <td className="py-3 px-4 text-center font-semibold text-slate-800">
                  +{g.plusOnes}
                </td>

                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {g.dietaryNeeds.map((d, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-900 border border-purple-100 capitalize"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {g.accessibilityNeeds.map((a, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-900 border border-blue-100 capitalize"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="py-3 px-4 text-slate-700 font-medium">
                  {g.tableNumber || '—'}
                </td>

                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingGuest(g);
                        setGName(g.name);
                        setGGroup(g.group);
                        setGRsvp(g.rsvpStatus);
                        setGPlusOnes(g.plusOnes);
                        setGPhone(g.phone || '');
                        setGEmail(g.email || '');
                        setGDietary(g.dietaryNeeds);
                        setGAccessibility(g.accessibilityNeeds);
                        setGTable(g.tableNumber || '');
                        setGNotes(g.notes || '');
                        setGuestModalOpen(true);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                      aria-label={`Edit guest ${g.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleDeleteGuest(g.id)}
                      className="p-1 text-slate-500 hover:text-rose-600 rounded transition-colors cursor-pointer"
                      aria-label={`Delete guest ${g.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CSV Import Modal */}
      <ModalShell
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="Import Guests from CSV Text"
        maxWidthClassName="max-w-lg"
        bodyClassName="p-6"
      >
        <form onSubmit={handleImportCsv} className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Paste comma-separated rows. Required format:{' '}
            <code>Name, Group, RSVP Status, Plus Ones, Phone, Email, Dietary, Accessibility, Table, Notes</code>
          </p>

          <label htmlFor="csv-input" className="block text-xs font-medium text-slate-800">
            CSV content
          </label>
          <textarea
            id="csv-input"
            rows={6}
            required
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder="Name, Group, RSVP Status, Plus Ones, Phone, Email, Dietary, Accessibility, Table, Notes&#10;Aarav Verma, family, attending, 1, +91 9820011111, aarav@example.com, veg, none, Table 2, Groom cousin"
            className="w-full text-xs p-3 font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-700 outline-hidden bg-[#FAF9F7]"
          />

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCsvModalOpen(false)}
              className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-900 text-white rounded-lg text-xs font-bold hover:bg-purple-950 transition-colors cursor-pointer"
            >
              Process CSV Import
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Guest Add / Edit Modal */}
      <ModalShell
        isOpen={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        title={editingGuest ? 'Edit Guest Details' : 'Add Guest Entry'}
        maxWidthClassName="max-w-md"
        bodyClassName="p-6 max-h-[85vh] overflow-y-auto"
      >
        <form onSubmit={handleSaveGuest} className="space-y-4">
          <div>
            <label htmlFor="guest-name" className="block text-xs font-medium text-slate-800 mb-1">Full Name</label>
            <input
              id="guest-name"
              type="text"
              required
              value={gName}
              onChange={(e) => setGName(e.target.value)}
              placeholder="e.g. Ramesh & Savita Gupta"
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="guest-group" className="block text-xs font-medium text-slate-800 mb-1">Group</label>
              <select
                id="guest-group"
                value={gGroup}
                onChange={(e) => setGGroup(e.target.value as GuestGroup)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
              >
                <option value="family">Family</option>
                <option value="friends">Friends</option>
                <option value="colleagues">Colleagues</option>
                <option value="vip">VIP</option>
                <option value="bride_side">Bride Side</option>
                <option value="groom_side">Groom Side</option>
              </select>
            </div>

            <div>
              <label htmlFor="guest-rsvp" className="block text-xs font-medium text-slate-800 mb-1">RSVP Status</label>
              <select
                id="guest-rsvp"
                value={gRsvp}
                onChange={(e) => setGRsvp(e.target.value as RsvpStatus)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
              >
                <option value="attending">Attending</option>
                <option value="tentative">Tentative</option>
                <option value="pending">Pending</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="guest-plus-ones" className="block text-xs font-medium text-slate-800 mb-1">
                Plus Ones Count
              </label>
              <input
                id="guest-plus-ones"
                type="number"
                min="0"
                max="20"
                value={gPlusOnes}
                onChange={(e) => setGPlusOnes(parseInt(e.target.value) || 0)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="guest-table" className="block text-xs font-medium text-slate-800 mb-1">Table Seating</label>
              <input
                id="guest-table"
                type="text"
                value={gTable}
                onChange={(e) => setGTable(e.target.value)}
                placeholder="e.g. Table 1"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="guest-phone" className="block text-xs font-medium text-slate-800 mb-1">Phone</label>
              <input
                id="guest-phone"
                type="text"
                value={gPhone}
                onChange={(e) => setGPhone(e.target.value)}
                placeholder="+91..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="guest-email" className="block text-xs font-medium text-slate-800 mb-1">Email</label>
              <input
                id="guest-email"
                type="email"
                value={gEmail}
                onChange={(e) => setGEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label htmlFor="guest-notes" className="block text-xs font-medium text-slate-800 mb-1">Notes</label>
            <textarea
              id="guest-notes"
              rows={2}
              value={gNotes}
              onChange={(e) => setGNotes(e.target.value)}
              placeholder="Elderly room proximity, arrival time..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setGuestModalOpen(false)}
              className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-900 text-white rounded-lg text-xs font-bold hover:bg-purple-950 transition-colors cursor-pointer"
            >
              Save Guest
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
};
