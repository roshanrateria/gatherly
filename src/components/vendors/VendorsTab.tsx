import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Star,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  Scale,
  Edit2,
  Trash2,
  Check,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { AppState, Vendor, VendorCategory, BookingStatus } from '../../types/index';
import { formatCurrency } from '../../lib/currency';

interface VendorsTabProps {
  state: AppState;
  onUpdateState: (newState: AppState) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg?: string) => void;
}

export const VendorsTab: React.FC<VendorsTabProps> = ({ state, onUpdateState, onShowToast }) => {
  const { vendors, event } = state;
  const currency = event.budget.currency;
  const numFormat = event.budget.numberFormat;

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Compare Mode State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectedVendorIdsForCompare, setSelectedVendorIdsForCompare] = useState<string[]>([]);

  // Selection Checklists Drawer State
  const [checklistDrawerOpen, setChecklistDrawerOpen] = useState(false);
  const [checklistCategory, setChecklistCategory] = useState<VendorCategory>('venue');

  // Form State
  const [vName, setVName] = useState('');
  const [vCategory, setVCategory] = useState<VendorCategory>('catering');
  const [vContact, setVContact] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vEmail, setVEmail] = useState('');
  const [vLocation, setVLocation] = useState('');
  const [vQuoted, setVQuoted] = useState<number>(0);
  const [vAgreed, setVAgreed] = useState<number>(0);
  const [vDeposit, setVDeposit] = useState<number>(0);
  const [vRating, setVRating] = useState<number>(5);
  const [vStatus, setVStatus] = useState<BookingStatus>('shortlisted');
  const [vDeliverables, setVDeliverables] = useState('');
  const [vNotes, setVNotes] = useState('');

  const filteredVendors = vendors.filter((v) => {
    if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && v.bookingStatus !== statusFilter) return false;
    if (
      searchQuery.trim() &&
      !v.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !v.category.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleSaveVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) return;

    const deliverablesList = vDeliverables
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingVendor) {
      const updated = vendors.map((v) =>
        v.id === editingVendor.id
          ? {
              ...v,
              name: vName,
              category: vCategory,
              contactPerson: vContact,
              phone: vPhone,
              email: vEmail,
              location: vLocation,
              quotedAmount: vQuoted,
              agreedCost: vAgreed,
              depositPaid: vDeposit,
              rating: vRating,
              bookingStatus: vStatus,
              deliverables: deliverablesList,
              notes: vNotes,
            }
          : v
      );
      onUpdateState({ ...state, vendors: updated });
      onShowToast('success', 'Vendor Updated', vName);
    } else {
      const newVendor: Vendor = {
        id: `v_${Date.now()}`,
        name: vName,
        category: vCategory,
        contactPerson: vContact,
        phone: vPhone,
        email: vEmail,
        location: vLocation,
        quotedAmount: vQuoted,
        agreedCost: vAgreed,
        depositPaid: vDeposit,
        rating: vRating,
        bookingStatus: vStatus,
        deliverables: deliverablesList,
        notes: vNotes,
        isShortlisted: true,
      };
      onUpdateState({ ...state, vendors: [...vendors, newVendor] });
      onShowToast('success', 'Vendor Added', vName);
    }

    setVendorModalOpen(false);
    setEditingVendor(null);
  };

  const handleDeleteVendor = (vendorId: string) => {
    onUpdateState({ ...state, vendors: vendors.filter((v) => v.id !== vendorId) });
    onShowToast('info', 'Vendor Removed');
  };

  const toggleShortlist = (vendorId: string) => {
    const updated = vendors.map((v) =>
      v.id === vendorId ? { ...v, isShortlisted: !v.isShortlisted } : v
    );
    onUpdateState({ ...state, vendors: updated });
  };

  const toggleSelectForCompare = (vendorId: string) => {
    if (selectedVendorIdsForCompare.includes(vendorId)) {
      setSelectedVendorIdsForCompare(selectedVendorIdsForCompare.filter((id) => id !== vendorId));
    } else {
      if (selectedVendorIdsForCompare.length >= 3) {
        onShowToast('warning', 'Comparison Limit', 'You can compare up to 3 vendors side-by-side.');
        return;
      }
      setSelectedVendorIdsForCompare([...selectedVendorIdsForCompare, vendorId]);
    }
  };

  // Vendor Hiring Checklists
  const hiringChecklists: Record<string, string[]> = {
    venue: [
      'Is the rental price inclusive of backup power generator and air conditioning?',
      'What are the municipal sound cutoff restrictions for outdoor music (e.g. 10:00 PM)?',
      'Are outside caterers or decorators permitted, or is there a royalty fee?',
      'Are there adequate wheelchair ramps and ground-floor restroom facilities?',
      'What is the vehicle parking capacity and is valet service included?',
    ],
    catering: [
      'Can you guarantee separate cooking stations and utensils for Pure Jain / Vegan dishes?',
      'What is the plate guarantee buffer policy (e.g. +10% over RSVP)?',
      'Are uniform service staff, cutlery, and hydration stations included in the per-plate rate?',
      'Can we schedule a live menu tasting for 4 family members prior to contract lock?',
    ],
    photography: [
      'Will the primary lead photographer personally shoot the event, or is it an associate crew?',
      'What is the turnaround time for the teaser highlight reel (e.g. 48-72 hours)?',
      'Are 4K drone flyover permissions and battery licenses included?',
      'Do we receive unwatermarked raw high-resolution files on a dedicated hard drive?',
    ],
    decor: [
      'Will you provide 3D CAD renders or stage sketches before fabrication?',
      'Are fresh flowers sourced locally or imported? What is the contingency if specific flowers wilt?',
      'Does the quote include tear-down and cleanup logistics after event conclusion?',
    ],
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-editorial text-slate-900">
            Vendor Directory &amp; Contract Procurement
          </h2>
          <p className="text-xs text-slate-500">
            Compare vendor quotes, contracts, payment milestones and selection checklists with zero
            invented data
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedVendorIdsForCompare.length >= 2 && (
            <button
              onClick={() => setCompareModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Compare Selected ({selectedVendorIdsForCompare.length})</span>
            </button>
          )}

          <button
            onClick={() => setChecklistDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-purple-700" />
            <span>Hiring Checklists</span>
          </button>

          <button
            onClick={() => {
              setEditingVendor(null);
              setVName('');
              setVCategory('catering');
              setVContact('');
              setVPhone('');
              setVEmail('');
              setVLocation('');
              setVQuoted(0);
              setVAgreed(0);
              setVDeposit(0);
              setVRating(5);
              setVStatus('shortlisted');
              setVDeliverables('');
              setVNotes('');
              setVendorModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-purple-900 hover:bg-purple-950 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors by name or service..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg outline-hidden text-xs text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
          >
            <option value="all">All Categories</option>
            <option value="venue">Venue</option>
            <option value="catering">Catering &amp; Food</option>
            <option value="decor">Decor &amp; Floral</option>
            <option value="photography">Photography &amp; Cinema</option>
            <option value="entertainment">Entertainment &amp; DJ</option>
            <option value="transport">Transport &amp; Logistics</option>
            <option value="security">Security &amp; Safety</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
          >
            <option value="all">All Booking Statuses</option>
            <option value="researching">Researching</option>
            <option value="contacted">Contacted</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="quote_received">Quote Received</option>
            <option value="contract_signed">Contract Signed</option>
            <option value="deposit_paid">Deposit Paid</option>
            <option value="fully_paid">Fully Paid</option>
          </select>
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredVendors.map((v) => {
          const isSelectedForCompare = selectedVendorIdsForCompare.includes(v.id);
          const isBooked =
            v.bookingStatus === 'contract_signed' ||
            v.bookingStatus === 'deposit_paid' ||
            v.bookingStatus === 'fully_paid';

          return (
            <div
              key={v.id}
              className={`p-5 rounded-2xl border transition-all ${
                isSelectedForCompare
                  ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-400/20'
                  : 'bg-white border-slate-200 shadow-2xs hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{v.name}</h3>
                    <button
                      onClick={() => toggleShortlist(v.id)}
                      className="text-amber-400 hover:text-amber-500"
                    >
                      <Star
                        className={`w-4 h-4 ${v.isShortlisted ? 'fill-amber-400' : 'text-slate-300'}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="capitalize px-2 py-0.2 rounded bg-purple-50 text-purple-900 font-medium border border-purple-100">
                      {v.category}
                    </span>
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                        isBooked
                          ? 'bg-emerald-100 text-emerald-800'
                          : v.bookingStatus === 'quote_received'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {v.bookingStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Rating Stars */}
                <div className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < v.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Financials Pill */}
              <div className="my-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Quoted</span>
                  <span className="font-semibold text-slate-700">
                    {formatCurrency(v.quotedAmount, currency, numFormat)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Agreed Cost</span>
                  <span className="font-bold text-purple-950">
                    {formatCurrency(v.agreedCost, currency, numFormat)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Deposit Paid</span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(v.depositPaid, currency, numFormat)}
                  </span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-1 text-xs text-slate-600 mb-3">
                {v.contactPerson && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">Contact: {v.contactPerson}</span>
                  </div>
                )}
                {v.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{v.phone}</span>
                  </div>
                )}
                {v.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{v.email}</span>
                  </div>
                )}
                {v.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="line-clamp-1">{v.location}</span>
                  </div>
                )}
              </div>

              {/* Deliverables tags */}
              {v.deliverables && v.deliverables.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Agreed Deliverables
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {v.deliverables.map((del, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                      >
                        ✓ {del}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSelectedForCompare}
                    onChange={() => toggleSelectForCompare(v.id)}
                    className="rounded text-purple-900 focus:ring-purple-700"
                  />
                  <span>Select for Compare</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setEditingVendor(v);
                      setVName(v.name);
                      setVCategory(v.category);
                      setVContact(v.contactPerson || '');
                      setVPhone(v.phone || '');
                      setVEmail(v.email || '');
                      setVLocation(v.location || '');
                      setVQuoted(v.quotedAmount);
                      setVAgreed(v.agreedCost);
                      setVDeposit(v.depositPaid);
                      setVRating(v.rating);
                      setVStatus(v.bookingStatus);
                      setVDeliverables((v.deliverables || []).join('\n'));
                      setVNotes(v.notes || '');
                      setVendorModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteVendor(v.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Side-by-Side Comparison Modal */}
      {compareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-900" />
                <h3 className="text-base font-bold text-slate-900 font-editorial">
                  Side-by-Side Vendor Evaluation
                </h3>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedVendorIdsForCompare.map((vid) => {
                const vend = vendors.find((v) => v.id === vid);
                if (!vend) return null;
                return (
                  <div
                    key={vend.id}
                    className="p-4 rounded-xl border border-slate-200 bg-[#FAF9F7] space-y-3 text-xs"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{vend.name}</h4>
                      <span className="text-purple-900 font-medium capitalize block">
                        {vend.category}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Quoted Rate</span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(vend.quotedAmount, currency, numFormat)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Agreed Rate</span>
                        <span className="font-bold text-purple-950">
                          {formatCurrency(vend.agreedCost, currency, numFormat)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Deposit Paid</span>
                        <span className="text-emerald-700 font-semibold">
                          {formatCurrency(vend.depositPaid, currency, numFormat)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Rating &amp; Status
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-bold text-amber-600">★ {vend.rating}.0 / 5</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800 uppercase font-semibold">
                          {vend.bookingStatus.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {vend.deliverables && vend.deliverables.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Included Services
                        </span>
                        <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-[11px]">
                          {vend.deliverables.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Hiring Checklists Drawer */}
      {checklistDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-900" />
                <h3 className="text-base font-bold text-slate-900 font-editorial">
                  Vendor Selection Checklists &amp; Questions to Ask
                </h3>
              </div>
              <button
                onClick={() => setChecklistDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            {/* Category Switcher */}
            <div className="flex gap-2">
              {(['venue', 'catering', 'photography', 'decor'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setChecklistCategory(cat)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                    checklistCategory === cat
                      ? 'bg-purple-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Checklist Items */}
            <div className="space-y-2 pt-2">
              {(hiringChecklists[checklistCategory] || []).map((q, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-slate-800 flex items-start gap-2.5"
                >
                  <Check className="w-4 h-4 text-purple-900 shrink-0 mt-0.5" />
                  <span>{q}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vendor Add / Edit Modal */}
      {vendorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveVendor}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95"
          >
            <h3 className="text-base font-bold text-slate-900 font-editorial">
              {editingVendor ? 'Edit Vendor Record' : 'Add New Vendor'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vendor / Business Name
                </label>
                <input
                  type="text"
                  required
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g. Royal Gourmet Caterers"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={vCategory}
                  onChange={(e) => setVCategory(e.target.value as VendorCategory)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
                >
                  <option value="venue">Venue</option>
                  <option value="catering">Catering &amp; Food</option>
                  <option value="decor">Decor &amp; Floral</option>
                  <option value="photography">Photography &amp; Video</option>
                  <option value="entertainment">Entertainment &amp; DJ</option>
                  <option value="transport">Transport</option>
                  <option value="security">Security</option>
                  <option value="other">Other Service</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Quoted ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={vQuoted}
                  onChange={(e) => setVQuoted(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Agreed Cost ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={vAgreed}
                  onChange={(e) => setVAgreed(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Deposit Paid ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  value={vDeposit}
                  onChange={(e) => setVDeposit(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Booking Status
                </label>
                <select
                  value={vStatus}
                  onChange={(e) => setVStatus(e.target.value as BookingStatus)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
                >
                  <option value="researching">Researching</option>
                  <option value="contacted">Contacted</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="quote_received">Quote Received</option>
                  <option value="contract_signed">Contract Signed</option>
                  <option value="deposit_paid">Deposit Paid</option>
                  <option value="fully_paid">Fully Paid</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Rating (1 to 5)
                </label>
                <select
                  value={vRating}
                  onChange={(e) => setVRating(parseInt(e.target.value) || 5)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
                >
                  <option value="5">★★★★★ (5 Stars - Exceptional)</option>
                  <option value="4">★★★★☆ (4 Stars - Recommended)</option>
                  <option value="3">★★★☆☆ (3 Stars - Average)</option>
                  <option value="2">★★☆☆☆ (2 Stars - Inconsistent)</option>
                  <option value="1">★☆☆☆☆ (1 Star - Caution)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={vContact}
                  onChange={(e) => setVContact(e.target.value)}
                  placeholder="Manager / Owner"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={vPhone}
                  onChange={(e) => setVPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Deliverables (One per line)
              </label>
              <textarea
                rows={2}
                value={vDeliverables}
                onChange={(e) => setVDeliverables(e.target.value)}
                placeholder="Drone 4K aerials&#10;Teaser video within 48h&#10;High-res raw files"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setVendorModalOpen(false)}
                className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-900 text-white rounded-lg text-xs font-bold hover:bg-purple-950 transition-colors cursor-pointer"
              >
                Save Vendor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
