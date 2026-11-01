import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateBudgetSummary, generateSavingsTradeOffs } from '../src/lib/deterministicBudget.ts';
import { generateMilestonesForEvent, recalculateTimelineForNewDate, checkMilestoneDependencies } from '../src/lib/deterministicTimeline.ts';
import { detectScheduleConflicts } from '../src/lib/deterministicSchedule.ts';
import { parseNaturalLanguageBrief } from '../src/lib/naturalLanguageParser.ts';
import { runOfflinePlanner } from '../src/lib/offlinePlanner.ts';
import { createSampleWedding } from '../src/lib/sampleEvents.ts';
import { validateAndImportState } from '../src/lib/storage.ts';
import { formatCurrency } from '../src/lib/currency.ts';

describe('1. Deterministic Budget Math & Overrun Tests', () => {
  it('accurately calculates allocations, balance, and per-guest metrics', () => {
    const totalBudget = 2000000; // 20 Lakhs
    const categories = [
      { id: 'c1', name: 'Catering', allocationPercent: 50, allocatedAmount: 1000000, priority: 'must_have' as const, description: 'Food' },
      { id: 'c2', name: 'Venue', allocationPercent: 50, allocatedAmount: 1000000, priority: 'must_have' as const, description: 'Hall' },
    ];
    const expenses = [
      { id: 'e1', categoryId: 'c1', title: 'Buffet', estimatedCost: 900000, actualCost: 850000, paidAmount: 400000, paymentStatus: 'deposit_paid' as const },
      { id: 'e2', categoryId: 'c2', title: 'Hall Advance', estimatedCost: 1000000, actualCost: 1000000, paidAmount: 1000000, paymentStatus: 'paid_in_full' as const },
    ];
    const guests = 200;

    const summary = calculateBudgetSummary(totalBudget, categories, expenses, guests);

    assert.strictEqual(summary.totalBudget, 2000000);
    assert.strictEqual(summary.totalAllocated, 2000000);
    assert.strictEqual(summary.unallocated, 0);
    assert.strictEqual(summary.totalEstimated, 1900000);
    assert.strictEqual(summary.totalActual, 1850000);
    assert.strictEqual(summary.totalPaid, 1400000);
    assert.strictEqual(summary.pendingPayment, 450000);
    assert.strictEqual(summary.remainingBalance, 150000);
    assert.strictEqual(summary.isOverrun, false);
    assert.strictEqual(summary.overrunAmount, 0);
    assert.strictEqual(summary.perGuestEstimated, 9500); // 1,900,000 / 200
    assert.strictEqual(summary.perGuestActual, 9250); // 1,850,000 / 200
  });

  it('correctly detects budget overrun when actual or estimated exceeds total', () => {
    const totalBudget = 1000000;
    const categories = [
      { id: 'c1', name: 'Catering', allocationPercent: 100, allocatedAmount: 1000000, priority: 'must_have' as const, description: '' },
    ];
    const expenses = [
      { id: 'e1', categoryId: 'c1', title: 'Luxury Buffet', estimatedCost: 1250000, actualCost: 1200000, paidAmount: 500000, paymentStatus: 'deposit_paid' as const },
    ];

    const summary = calculateBudgetSummary(totalBudget, categories, expenses, 100);

    assert.strictEqual(summary.isOverrun, true);
    assert.strictEqual(summary.overrunAmount, 250000); // max(1200000 - 1000000, 1250000 - 1000000)
    assert.strictEqual(summary.remainingBalance, -200000);
  });

  it('generates savings recommendations that protect must-have priorities', () => {
    const categories = [
      { id: 'c1', name: 'Catering & Hospitality', allocationPercent: 40, allocatedAmount: 400000, priority: 'must_have' as const, description: '' },
      { id: 'c2', name: 'Floral Decor', allocationPercent: 30, allocatedAmount: 300000, priority: 'flexible' as const, description: '' },
      { id: 'c3', name: 'Souvenirs & Favors', allocationPercent: 10, allocatedAmount: 100000, priority: 'flexible' as const, description: '' },
      { id: 'c4', name: 'Photography', allocationPercent: 20, allocatedAmount: 200000, priority: 'high' as const, description: '' },
    ];

    const tradeOffs = generateSavingsTradeOffs(80000, categories, ['Photography', 'Catering']);

    // Must NOT cut Catering or Photography
    const cutCategories = tradeOffs.map(t => t.categoryName);
    assert.ok(!cutCategories.includes('Catering & Hospitality'), 'Must have category was cut!');
    assert.ok(!cutCategories.includes('Photography'), 'Protected top priority was cut!');
    assert.ok(tradeOffs.length > 0, 'Should propose savings from flexible categories');
  });

  it('formats Indian Lakhs and Crores with currency symbols correctly', () => {
    assert.strictEqual(formatCurrency(4500000, 'INR', 'lakhs'), '₹45 L');
    assert.strictEqual(formatCurrency(15000000, 'INR', 'lakhs'), '₹1.5 Cr');
    assert.strictEqual(formatCurrency(75000, 'INR', 'lakhs'), '₹75,000');
    assert.strictEqual(formatCurrency(5000, 'USD', 'international'), '$5,000');
  });
});

describe('2. Deterministic Timeline & Rescheduling Tests', () => {
  it('generates scaled milestones based on date and duration', () => {
    const { milestones, tasks } = generateMilestonesForEvent('wedding', '2026-11-20');
    assert.ok(milestones.length >= 5, 'Should generate comprehensive milestones');
    assert.ok(tasks.length >= 10, 'Should generate matching action tasks');

    // Milestones should be in chronological order
    for (let i = 0; i < milestones.length - 1; i++) {
      assert.ok(milestones[i].dueDate <= milestones[i + 1].dueDate, 'Milestones should be chronologically ordered');
    }
  });

  it('recalculates deadlines dynamically when event date changes', () => {
    const { milestones, tasks } = generateMilestonesForEvent('wedding', '2026-11-20');
    const oldFirstDue = milestones[0].dueDate;

    const { updatedMilestones, updatedTasks } = recalculateTimelineForNewDate(milestones, tasks, '2026-12-25');
    const newFirstDue = updatedMilestones[0].dueDate;

    assert.strictEqual(updatedTasks.length, tasks.length, 'Task count is preserved across rescheduling');
    assert.notStrictEqual(oldFirstDue, newFirstDue, 'Due date must shift with event date');
    assert.ok(newFirstDue > oldFirstDue, 'New due date should be later when event is postponed');
  });

  it('detects inverted dependencies between milestones', () => {
    const milestones = [
      { id: 'm1', title: 'Venue contract', category: 'Venue', dueDate: '2026-09-01', daysBeforeEvent: 80, completed: false, priority: 'high' as const, dependencies: [], isAtRisk: false, autoGenerated: true },
      { id: 'm2', title: 'Soundcheck', category: 'AV', dueDate: '2026-08-01', daysBeforeEvent: 110, completed: false, priority: 'high' as const, dependencies: ['m1'], isAtRisk: false, autoGenerated: true },
    ];

    const results = checkMilestoneDependencies(milestones);
    const issue = results.find(r => r.milestoneId === 'm2');
    assert.strictEqual(issue?.hasDependencyIssue, true, 'Should detect m2 is due earlier than prerequisite m1');
  });
});

describe('3. Event Schedule & Conflict Engine Tests', () => {
  it('detects direct time overlaps on the same day', () => {
    const items = [
      { id: 's1', dayNumber: 1, date: '2026-11-20', startTime: '18:00', endTime: '20:00', durationMinutes: 120, title: 'Sangeet Opening', category: 'ceremony' as const, location: 'Ballroom', owner: 'Lead' },
      { id: 's2', dayNumber: 1, date: '2026-11-20', startTime: '19:30', endTime: '21:00', durationMinutes: 90, title: 'Dinner Buffet', category: 'meal' as const, location: 'Dining Hall', owner: 'Caterer' },
    ];

    const conflicts = detectScheduleConflicts(items);
    const overlapConflict = conflicts.find(c => c.type === 'overlap');
    assert.ok(overlapConflict !== undefined, 'Overlap conflict must be detected');
    assert.strictEqual(overlapConflict?.severity, 'critical');
  });

  it('warns about tight transitions between different physical locations', () => {
    const items = [
      { id: 's1', dayNumber: 1, date: '2026-11-20', startTime: '16:00', endTime: '17:00', durationMinutes: 60, title: 'Mehendi', category: 'ceremony' as const, location: 'Lawn Area', owner: 'Decor' },
      { id: 's2', dayNumber: 1, date: '2026-11-20', startTime: '17:05', endTime: '18:00', durationMinutes: 55, title: 'Sangeet Walkthrough', category: 'entertainment' as const, location: 'Palace Ballroom', owner: 'Host' },
    ];

    const conflicts = detectScheduleConflicts(items);
    assert.strictEqual(conflicts.length, 1);
    assert.strictEqual(conflicts[0].type, 'insufficient_transition');
  });
});

describe('4. Natural Language Brief Parser Tests', () => {
  it('extracts event type, guest count, location, and Indian budget correctly', () => {
    const text = 'Planning a 3-day Punjabi wedding in Udaipur for 250 guests in November 2026 with a budget of 45 lakhs. Food and photography are our top priorities, strictly pure veg and need wheelchair access for grandparents.';
    const parsed = parseNaturalLanguageBrief(text);

    assert.strictEqual(parsed.eventType, 'wedding');
    assert.strictEqual(parsed.durationDays, 3);
    assert.strictEqual(parsed.guestCount, 250);
    assert.strictEqual(parsed.budgetAmount, 4500000);
    assert.strictEqual(parsed.locationCity, 'Udaipur');
    assert.strictEqual(parsed.currency, 'INR');
    assert.ok(parsed.dietary.some(d => d.toLowerCase().includes('veg')));
    assert.ok(parsed.accessibility.some(a => a.toLowerCase().includes('wheelchair')));
  });

  it('handles international brief with USD budget and corporate event type', () => {
    const text = 'Organizing a corporate leadership summit in Singapore for 150 attendees with $25,000 budget.';
    const parsed = parseNaturalLanguageBrief(text);

    assert.strictEqual(parsed.eventType, 'corporate');
    assert.strictEqual(parsed.guestCount, 150);
    assert.strictEqual(parsed.budgetAmount, 25000);
    assert.strictEqual(parsed.currency, 'USD');
  });
});

describe('5. Offline AI Planner & Decision Rules Tests', () => {
  it('recalculates per-guest pressure and generates proposal when guests increase with fixed budget', () => {
    const state = createSampleWedding();
    const prompt = 'We need to increase guests from 250 to 350 but total budget is strictly fixed at 45 lakhs.';

    const response = runOfflinePlanner(prompt, state);

    assert.ok(response.message.length > 50);
    assert.ok(response.reasoning_summary.length > 20);
    assert.ok(response.assumptions.length >= 1);
    assert.ok(response.recommendations.length >= 2);
    assert.ok(response.risks.length >= 1);
    assert.ok(response.proposed_changes.length >= 1, 'Should propose guest and budget reallocation changes');

    const guestProposal = response.proposed_changes.find(p => p.section === 'guest');
    assert.strictEqual(guestProposal?.afterValue, 350);
  });

  it('proposes reallocation when photography is prioritized over decor', () => {
    const state = createSampleWedding();
    const prompt = 'Photography has become a higher priority than decoration. Please reallocate our budget.';

    const response = runOfflinePlanner(prompt, state);

    assert.ok(response.message.toLowerCase().includes('photo'));
    const budgetProposal = response.proposed_changes.find(p => p.section === 'budget');
    assert.ok(budgetProposal !== undefined, 'Should propose reallocation to photography');
  });
});

describe('6. Data Persistence & Schema Validation Tests', () => {
  it('validates and accepts compliant state JSON', () => {
    const sample = createSampleWedding();
    const jsonStr = JSON.stringify(sample);
    const result = validateAndImportState(jsonStr);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.state?.event.title, sample.event.title);
  });

  it('safely rejects malformed or incomplete state JSON without crashing', () => {
    const invalidJson = '{"corrupted": true}';
    const result = validateAndImportState(invalidJson);

    assert.strictEqual(result.success, false);
    assert.ok(result.error !== undefined);
  });
});
