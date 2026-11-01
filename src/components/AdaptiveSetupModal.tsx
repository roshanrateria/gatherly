import React, { useState } from 'react';
import {
  Sparkles,
  Wand2,
  ListChecks,
  Check,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { EventType, VenueStatus, EventDetails, AppState } from '../types/index';
import { CurrencyCode, CURRENCY_CONFIGS, NumberFormat } from '../types/currency';
import { parseNaturalLanguageBrief, ParsedEventBrief } from '../lib/naturalLanguageParser';
import { generateDefaultCategoriesForEvent } from '../lib/deterministicBudget';
import { generateMilestonesForEvent } from '../lib/deterministicTimeline';
import { generateDefaultSchedule } from '../lib/deterministicSchedule';
import { getDefaultIdeasForEvent } from '../lib/creativeIdeas';
import { formatCurrency } from '../lib/currency';
import { createId } from '../lib/createId';
import { addDaysISO } from '../lib/dates';
import { clampBudgetAmount, clampGuestCount } from '../lib/aiValidation';
import { ModalShell } from './ui/ModalShell';

interface AdaptiveSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: (newState: AppState) => void;
  currentCurrency: CurrencyCode;
}

export const AdaptiveSetupModal: React.FC<AdaptiveSetupModalProps> = ({
  isOpen,
  onClose,
  onEventCreated,
  currentCurrency,
}) => {
  const [mode, setMode] = useState<'brief' | 'wizard'>('brief');

  // Natural Language brief state
  const [briefInput, setBriefInput] = useState(
    'Planning a 3-day royal wedding in Udaipur for 250 guests in November 2026, budget 45 lakhs. Food and photography are our top priorities, strictly pure veg and wheelchair access needed for grandparents.'
  );
  const [parsedBrief, setParsedBrief] = useState<ParsedEventBrief | null>(() =>
    parseNaturalLanguageBrief(briefInput)
  );

  // Wizard state
  const [step, setStep] = useState<number>(1);
  const [eventType, setEventType] = useState<EventType>('wedding');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('2026-11-20');
  const [durationDays, setDurationDays] = useState(3);
  const [city, setCity] = useState('Udaipur');
  const [venueStatus, setVenueStatus] = useState<VenueStatus>('searching');
  const [venueName, setVenueName] = useState('');
  const [guestCount, setGuestCount] = useState(250);
  const [budgetAmount, setBudgetAmount] = useState(4500000);
  const [currency, setCurrency] = useState<CurrencyCode>(currentCurrency || 'INR');
  const [numberFormat, setNumberFormat] = useState<NumberFormat>('lakhs');
  const [style, setStyle] = useState('Royal Heritage & Warm Traditional Elegance');
  const [priorities, setPriorities] = useState<string[]>([
    'Food & Catering',
    'Photography & Cinematography',
    'Decor & Florals',
  ]);
  const [dietary, setDietary] = useState<string[]>(['Pure Vegetarian', 'Jain Options']);
  const [accessibility, setAccessibility] = useState<string[]>([
    'Wheelchair Accessible Ramps',
    'Ground Floor Rooms',
  ]);

  if (!isOpen) return null;

  const handleBriefChange = (val: string) => {
    setBriefInput(val);
    if (val.trim().length > 10) {
      const parsed = parseNaturalLanguageBrief(val);
      setParsedBrief(parsed);
      // populate wizard fields
      setEventType(parsed.eventType);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.startDate) setStartDate(parsed.startDate);
      if (parsed.durationDays) setDurationDays(parsed.durationDays);
      if (parsed.locationCity) setCity(parsed.locationCity);
      if (parsed.guestCount) setGuestCount(parsed.guestCount);
      if (parsed.budgetAmount) setBudgetAmount(parsed.budgetAmount);
      if (parsed.currency) {
        setCurrency(parsed.currency);
        setNumberFormat(CURRENCY_CONFIGS[parsed.currency].defaultFormat);
      }
      if (parsed.venueStatus) setVenueStatus(parsed.venueStatus);
      if (parsed.priorities.length > 0) setPriorities(parsed.priorities);
      if (parsed.dietary.length > 0) setDietary(parsed.dietary);
      if (parsed.accessibility.length > 0) setAccessibility(parsed.accessibility);
    }
  };

  const handleCreateFromPlan = () => {
    const finalTitle = title.trim() || `${city || 'Destination'} ${eventType.toUpperCase()} Celebration`;
    const finalStartDate = startDate || '2026-11-20';
    const finalEndDate = addDaysISO(finalStartDate, durationDays - 1);

    const finalEvent: EventDetails = {
      id: createId('event'),
      title: finalTitle,
      type: eventType,
      startDate: finalStartDate,
      endDate: finalEndDate,
      durationDays,
      location: {
        city: city || 'City',
        venueName: venueName || (venueStatus === 'secured' ? 'Confirmed Venue' : undefined),
        venueStatus,
        country: currency === 'INR' ? 'India' : 'International',
      },
      guests: {
        count: guestCount,
        bufferPercent: 10,
        expectedAttendance: Math.round(guestCount * 0.95),
      },
      budget: {
        total: budgetAmount,
        currency,
        numberFormat,
      },
      style,
      priorities,
      requirements: {
        dietary,
        accessibility,
        culturalTradition: `${eventType.toUpperCase()} celebration`,
        leadTimeMonths: 6,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const categories = generateDefaultCategoriesForEvent(eventType, budgetAmount, priorities);
    const { milestones, tasks } = generateMilestonesForEvent(eventType, finalStartDate);
    const schedule = generateDefaultSchedule(eventType, finalStartDate, durationDays);
    const ideas = getDefaultIdeasForEvent(eventType);

    const newState: AppState = {
      event: finalEvent,
      categories,
      expenses: [],
      scenarios: [
        {
          id: 'scen_base',
          name: 'Base Target Scenario',
          description: `Full standard allocation of ${formatCurrency(budgetAmount, currency, numberFormat)}.`,
          multiplier: 1.0,
          categoryAdjustments: {},
        },
        {
          id: 'scen_lean',
          name: 'Optimized Lean (-15%)',
          description: 'Focuses strictly on essential must-haves and trims secondary line items.',
          multiplier: 0.85,
          categoryAdjustments: {},
        },
      ],
      milestones,
      tasks,
      vendors: [],
      guests: [],
      schedule,
      ideas,
      chatHistory: [
        {
          id: createId('msg_init'),
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          text: `Welcome to your connected workspace for "${finalTitle}"! I have populated your deterministic budget categories, milestones timeline, 1-click vendor checklists, and multi-day run sheet tailored to ${guestCount} guests in ${city || 'your destination'}. Ask me anytime to adjust constraints or analyze trade-offs.`,
          structuredResponse: {
            message: `Workspace initialized for ${finalTitle}.`,
            reasoning_summary: `Generated dynamic milestones and budget allocations based on ${durationDays}-day duration and explicit priorities: ${priorities.join(', ')}.`,
            assumptions: [
              `Target guest count is ${guestCount} attendees.`,
              `Total budget target is ${formatCurrency(budgetAmount, currency, numberFormat)}.`,
            ],
            clarifying_questions: [
              venueStatus !== 'secured'
                ? 'Would you like to shortlist venue options matching your guest capacity?'
                : 'Have you locked primary caterer contract terms yet?',
            ],
            recommendations: [
              'Review and fine-tune your Budget category allocations in the Budget tab.',
              'Check Timeline for at-risk tasks based on your event date.',
            ],
            proposed_changes: [],
            affected_sections: ['Overview', 'Budget', 'Timeline', 'Schedule'],
            risks: [],
            next_steps: ['Begin shortlisting vendors and customizing your run sheet.'],
          },
        },
      ],
      proposalsHistory: [],
      aiConfig: {
        provider: 'offline',
        apiKey: '',
        model: 'offline-deterministic',
        discloseDataSharing: false,
      },
    };

    onEventCreated(newState);
    onClose();
  };

  const eventTypeOptions: { type: EventType; label: string; desc: string }[] = [
    { type: 'wedding', label: 'Wedding Celebration', desc: 'Single or multi-day sacred rites, sangeet, reception' },
    { type: 'birthday', label: 'Milestone Birthday', desc: '1st, 18th, 21st, 30th, 50th or jubilee celebrations' },
    { type: 'anniversary', label: 'Anniversary Gala', desc: 'Silver, golden or intimate anniversary milestones' },
    { type: 'corporate', label: 'Corporate Function', desc: 'Leadership summit, gala dinner, product launch' },
    { type: 'college_fest', label: 'College Festival', desc: 'Cultural or technical campus festival & concert' },
    { type: 'community', label: 'Community Gathering', desc: 'Diwali mela, charity gala, society banquet' },
  ];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Adaptive Event Setup"
      description="Natural-language ingestion or step-by-step guided architect"
      maxWidthClassName="max-w-3xl"
      headerClassName="bg-gradient-to-r from-purple-900 via-rose-950 to-amber-900 text-white"
      /* The setup wizard is the app's tallest form. Without a body max-height
         the panel overflows the fixed overlay on small viewports, leaving the
         footer nav buttons unreachable (platform page scroll is locked by
         the dialog). Keep the ModalShell scroll contract here. */
      bodyClassName="p-0 max-h-[65vh] overflow-y-auto"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {mode === 'wizard' && step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <span>Next Step</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreateFromPlan}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-900 to-rose-900 text-white shadow-md hover:from-purple-950 hover:to-rose-950 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" aria-hidden="true" />
                <span>Confirm &amp; Build Master Workspace</span>
              </button>
            )}
          </div>
        </>
      }
    >
      {/* Tab Toggle: Natural Language Brief vs Wizard */}
      <div className="px-6 pt-4 border-b border-slate-200 flex gap-4" role="group" aria-label="Setup mode">
        <button
          onClick={() => setMode('brief')}
          aria-pressed={mode === 'brief'}
          className={`pb-3 px-1 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            mode === 'brief'
              ? 'border-purple-900 text-purple-900'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          <Wand2 className="w-4 h-4" aria-hidden="true" />
          <span>Natural-Language Brief (Fastest)</span>
        </button>
        <button
          onClick={() => setMode('wizard')}
          aria-pressed={mode === 'wizard'}
          className={`pb-3 px-1 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            mode === 'wizard'
              ? 'border-purple-900 text-purple-900'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          <ListChecks className="w-4 h-4" aria-hidden="true" />
          <span>Step-by-Step Guided Wizard</span>
        </button>
      </div>

      {/* Modal Body */}
      <div className="p-6">
          {mode === 'brief' ? (
            <div className="space-y-5">
              <div>
                <label htmlFor="setup-brief" className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Paste or Describe Your Event Vision in Plain English
                </label>
                <textarea
                  id="setup-brief"
                  rows={4}
                  value={briefInput}
                  onChange={(e) => handleBriefChange(e.target.value)}
                  placeholder="e.g. Planning a 3-day royal wedding in Udaipur for 250 guests in November 2026 with a budget of 45 lakhs. Food and photography are our top priorities, strictly pure veg and wheelchair accessibility for grandparents."
                  className="w-full text-sm p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-700 focus:border-transparent outline-hidden bg-[#FAF9F6] leading-relaxed"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Gatherly automatically extracts dates, headcounts, currencies, priorities, dietary
                  constraints, and accessibility requirements.
                </p>
              </div>

              {/* Sample Presets to Click */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Quick prompts:</span>
                <button
                  type="button"
                  onClick={() =>
                    handleBriefChange(
                      '3-day royal Indian wedding in Udaipur for 250 guests in November 2026, budget 45 lakhs, venue searching, food and photography top priorities, strictly pure veg with Jain kitchen.'
                    )
                  }
                  className="text-xs px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-md border border-purple-200 transition-colors"
                >
                  Udaipur Wedding (₹45 L)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleBriefChange(
                      'Corporate Tech Summit in Bengaluru for 350 executives in December 2026, budget 30 lakhs, venue secured, keynote staging and executive catering are top priorities.'
                    )
                  }
                  className="text-xs px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-md border border-indigo-200 transition-colors"
                >
                  Tech Summit (₹30 L)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleBriefChange(
                      'Milestone 40th birthday sunset lounge party in Mumbai for 75 friends on 28 Nov 2026, budget 5 lakhs, DJ and signature cocktails top priority.'
                    )
                  }
                  className="text-xs px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-md border border-rose-200 transition-colors"
                >
                  40th Birthday (₹5 L)
                </button>
              </div>

              {/* Extracted Structured Card */}
              {parsedBrief && (
                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Extracted Structured Blueprint
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-900">
                      {parsedBrief.confidenceScore}% Confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                      <span className="text-slate-500 block">Event Type</span>
                      <strong className="text-slate-900 font-semibold capitalize">
                        {parsedBrief.eventType.replace('_', ' ')}
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                      <span className="text-slate-500 block">Guests</span>
                      <strong className="text-slate-900 font-semibold">
                        {parsedBrief.guestCount || 100} Pax
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                      <span className="text-slate-500 block">Duration</span>
                      <strong className="text-slate-900 font-semibold">
                        {parsedBrief.durationDays} Day(s)
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                      <span className="text-slate-500 block">Budget</span>
                      <strong className="text-purple-950 font-bold">
                        {parsedBrief.budgetAmount
                          ? formatCurrency(parsedBrief.budgetAmount, parsedBrief.currency, 'lakhs')
                          : '₹10 L target'}
                      </strong>
                    </div>
                  </div>

                  {/* Priorities & Requirements */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {parsedBrief.priorities.map((p, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 bg-amber-100/70 text-amber-900 border border-amber-200 rounded"
                      >
                        Priority: {p}
                      </span>
                    ))}
                    {parsedBrief.dietary.map((d, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 bg-emerald-100/70 text-emerald-900 border border-emerald-200 rounded"
                      >
                        Dietary: {d}
                      </span>
                    ))}
                    {parsedBrief.accessibility.map((a, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 bg-blue-100/70 text-blue-900 border border-blue-200 rounded"
                      >
                        Access: {a}
                      </span>
                    ))}
                  </div>

                  {parsedBrief.missingFields.length > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Optional follow-up needed: {parsedBrief.missingFields.join(', ')}. You can
                        refine them now or later in workspace settings.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Wizard Mode */
            <div className="space-y-5">
              {/* Step Navigation Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  aria-pressed={step === 1}
                  onClick={() => setStep(1)}
                  className={`px-3 py-1 rounded-md ${
                    step === 1 ? 'bg-purple-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  1. Basics &amp; Dates
                </button>
                <button
                  type="button"
                  aria-pressed={step === 2}
                  onClick={() => setStep(2)}
                  className={`px-3 py-1 rounded-md ${
                    step === 2 ? 'bg-purple-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  2. Venue &amp; Guests
                </button>
                <button
                  type="button"
                  aria-pressed={step === 3}
                  onClick={() => setStep(3)}
                  className={`px-3 py-1 rounded-md ${
                    step === 3 ? 'bg-purple-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  3. Budget &amp; Currency
                </button>
                <button
                  type="button"
                  aria-pressed={step === 4}
                  onClick={() => setStep(4)}
                  className={`px-3 py-1 rounded-md ${
                    step === 4 ? 'bg-purple-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  4. Priorities &amp; Needs
                </button>
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Choose Celebration Type
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {eventTypeOptions.map((opt) => (
                        <button
                          key={opt.type}
                          type="button"
                          aria-pressed={eventType === opt.type}
                          onClick={() => setEventType(opt.type)}
                          className={`p-3 text-left rounded-xl border transition-all ${
                            eventType === opt.type
                              ? 'border-purple-900 bg-purple-50 ring-2 ring-purple-900/10'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <h4 className="text-sm font-semibold text-slate-900">{opt.label}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label htmlFor="setup-title" className="block text-xs font-medium text-slate-800 mb-1">
                        Event Title
                      </label>
                      <input
                        id="setup-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Aanya & Siddharth's Royal Wedding"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                      />
                    </div>
                    <div>
                      <label htmlFor="setup-duration" className="block text-xs font-medium text-slate-800 mb-1">
                        Duration (Days)
                      </label>
                      <input
                        id="setup-duration"
                        type="number"
                        min="1"
                        max="14"
                        value={durationDays}
                        onChange={(e) => setDurationDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 3)))}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="setup-start-date" className="block text-xs font-medium text-slate-800 mb-1">
                      Event Start Date
                    </label>
                    <input
                      id="setup-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full sm:w-64 text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="setup-city" className="block text-xs font-medium text-slate-800 mb-1">
                        City / Destination
                      </label>
                      <input
                        id="setup-city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Udaipur, Mumbai, Goa, London"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                      />
                    </div>
                    <div>
                      <label htmlFor="setup-guests" className="block text-xs font-medium text-slate-800 mb-1">
                        Target Guest Count
                      </label>
                      <input
                        id="setup-guests"
                        type="number"
                        min="5"
                        max="10000"
                        value={guestCount}
                        onChange={(e) => setGuestCount(Math.max(5, clampGuestCount(parseInt(e.target.value) || 0)))}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Venue Status
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(
                        [
                          ['secured', 'Secured & Booked'],
                          ['shortlisting', 'Shortlisting (2-3)'],
                          ['searching', 'Still Searching'],
                          ['home_or_private', 'Private Residence / Lawn'],
                        ] as const
                      ).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setVenueStatus(val)}
                          className={`p-2.5 text-xs font-medium rounded-lg border text-center transition-colors ${
                            venueStatus === val
                              ? 'bg-purple-900 text-white border-purple-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {venueStatus === 'secured' && (
                    <div>
                      <label htmlFor="setup-venue-name" className="block text-xs font-medium text-slate-800 mb-1">
                        Secured Venue Name
                      </label>
                      <input
                        id="setup-venue-name"
                        type="text"
                        value={venueName}
                        onChange={(e) => setVenueName(e.target.value)}
                        placeholder="e.g. The Grand Palace & Lawns"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                      />
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="setup-currency" className="block text-xs font-medium text-slate-800 mb-1">
                        Currency
                      </label>
                      <select
                        id="setup-currency"
                        value={currency}
                        onChange={(e) => {
                          const c = e.target.value as CurrencyCode;
                          setCurrency(c);
                          setNumberFormat(CURRENCY_CONFIGS[c].defaultFormat);
                        }}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
                      >
                        {Object.values(CURRENCY_CONFIGS).map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} ({c.symbol}) — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="setup-number-format" className="block text-xs font-medium text-slate-800 mb-1">
                        Number Format Preference
                      </label>
                      <select
                        id="setup-number-format"
                        value={numberFormat}
                        onChange={(e) => setNumberFormat(e.target.value as NumberFormat)}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
                      >
                        <option value="lakhs">Indian System (Lakhs &amp; Crores, e.g. ₹45 L)</option>
                        <option value="international">
                          International Standard (Hundreds/Millions, e.g. 4,500,000)
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="setup-budget" className="block text-xs font-medium text-slate-800 mb-1">
                      Total Target Budget ({currency})
                    </label>
                    <input
                      id="setup-budget"
                      type="number"
                      step="10000"
                      min="1000"
                      value={budgetAmount}
                      onChange={(e) =>
                        setBudgetAmount(Math.max(1000, clampBudgetAmount(parseInt(e.target.value) || 0)))
                      }
                      className="w-full text-sm font-semibold p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Formatted Preview: {formatCurrency(budgetAmount, currency, numberFormat)} (approx.{' '}
                      {formatCurrency(
                        Math.round(budgetAmount / Math.max(1, guestCount)),
                        currency,
                        numberFormat
                      )}{' '}
                      per guest)
                    </p>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="setup-style" className="block text-xs font-medium text-slate-800 mb-1">
                      Theme / Aesthetic Style
                    </label>
                    <input
                      id="setup-style"
                      type="text"
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      placeholder="e.g. Royal Heritage, Minimalist Chic, Neon Sunset, Vintage Boho"
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Top Priorities (Ordered)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Catering & Hospitality',
                        'Photography & Cinematography',
                        'Decor & Florals',
                        'Music & Entertainment',
                        'Venue & Guest Comfort',
                        'Gifts & Keepsakes',
                      ].map((item) => {
                        const isSelected = priorities.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              if (isSelected) {
                                setPriorities(priorities.filter((p) => p !== item));
                              } else {
                                setPriorities([...priorities, item]);
                              }
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                              isSelected
                                ? 'bg-amber-100 border-amber-400 text-amber-950 font-semibold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '} {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dietary & Accessibility */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Dietary Requirements
                      </label>
                      <div className="space-y-1 text-xs">
                        {[
                          'Pure Vegetarian',
                          'Jain (No Root Veg / Onion)',
                          'Halal Certified',
                          'Vegan Options',
                          'Gluten-Free Station',
                        ].map((d) => (
                          <label key={d} className="flex items-center gap-2 text-slate-700">
                            <input
                              type="checkbox"
                              checked={dietary.includes(d)}
                              onChange={(e) => {
                                if (e.target.checked) setDietary([...dietary, d]);
                                else setDietary(dietary.filter((x) => x !== d));
                              }}
                              className="rounded text-purple-900 focus:ring-purple-700"
                            />
                            {d}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Accessibility Needs
                      </label>
                      <div className="space-y-1 text-xs">
                        {[
                          'Wheelchair Accessible Ramps',
                          'Ground Floor Rooms / Elevators',
                          'Elderly Assistance',
                          'Child Friendly Childcare Area',
                        ].map((a) => (
                          <label key={a} className="flex items-center gap-2 text-slate-700">
                            <input
                              type="checkbox"
                              checked={accessibility.includes(a)}
                              onChange={(e) => {
                                if (e.target.checked) setAccessibility([...accessibility, a]);
                                else setAccessibility(accessibility.filter((x) => x !== a));
                              }}
                              className="rounded text-purple-900 focus:ring-purple-700"
                            />
                            {a}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
    </ModalShell>
  );
};
