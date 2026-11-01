import { describe, it } from 'node:test';
import assert from 'node:assert';
import { applyProposalsToState, isApplicableSection } from '../src/lib/proposals.ts';
import { createSampleWedding } from '../src/lib/sampleEvents.ts';
import type { AppState, ProposedChange } from '../src/types/index.ts';

/**
 * Regression tests for the unified proposal-apply engine. Historically the
 * Dashboard and AI Planner each carried divergent apply logic that could read
 * stale state and drop or double-apply proposals when many were confirmed in
 * one batch (known bug #2).
 */

function sampleState(): AppState {
  return createSampleWedding();
}

describe('Unified Proposal Apply Engine', () => {
  it('applies every applicable proposal in a single batch without dropping any', () => {
    const state = sampleState();
    // Pre-date the sample so the engine's updatedAt bump is observable even
    // when sample creation and application happen in the same millisecond.
    state.event.updatedAt = '2000-01-01T00:00:00.000Z';
    const before = state;

    const proposals: ProposedChange[] = [
      {
        id: 'p_guest',
        section: 'guest',
        title: 'Increase guest count',
        description: 'Guests rose to 270',
        beforeValue: state.event.guests.count,
        afterValue: 270,
        applied: false,
        timestamp: '',
      },
      {
        id: 'p_decor',
        section: 'budget',
        title: 'Cut decor allocation',
        description: 'Simplify floral plan',
        afterValue: { decorAllocated: 400000 },
        applied: false,
        timestamp: '',
      },
      {
        id: 'p_catering',
        section: 'budget',
        title: 'Boost catering allocation',
        description: 'Add live counters',
        afterValue: { cateringAllocated: 1200000 },
        applied: false,
        timestamp: '',
      },
    ];

    const result = applyProposalsToState(state, proposals);

    assert.strictEqual(result.applied.length, 3, 'All three proposals should apply');
    assert.strictEqual(result.skipped.length, 0, 'Nothing should be skipped');

    // Single transaction guarantees the final state contains every change.
    assert.strictEqual(result.state.event.guests.count, 270, 'Guest count applied last-known value');
    assert.ok(result.state.event.updatedAt !== before.event.updatedAt, 'updatedAt bumped');

    const decor = result.state.categories.find(c => c.name.toLowerCase().includes('decor') || c.name.toLowerCase().includes('floral'));
    const catering = result.state.categories.find(c => c.name.toLowerCase().includes('cater') || c.name.toLowerCase().includes('food'));
    assert.ok(decor && decor.allocatedAmount === 400000, `Decor applied, got ${decor?.allocatedAmount}`);
    assert.ok(catering && catering.allocatedAmount === 1200000, `Catering applied, got ${catering?.allocatedAmount}`);

    // allocationPercent recomputed from the same amount (no drift).
    const expectedDecorPercent = Math.round((400000 / result.state.event.budget.total) * 100);
    assert.strictEqual(decor?.allocationPercent, expectedDecorPercent);
  });

  it('skips advisory sections with an actionable reason instead of crashing', () => {
    const result = applyProposalsToState(sampleState(), [
      {
        id: 'p_timeline',
        section: 'timeline',
        title: 'Move milestone earlier',
        description: 'Sangeet to earlier slot',
        afterValue: 'm_sangeet_shift',
        applied: false,
        timestamp: '',
      },
    ]);

    assert.strictEqual(result.applied.length, 0);
    assert.strictEqual(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /Advisory proposal/i);
    // State untouched.
    assert.strictEqual(result.state.event.title, sampleState().event.title);
  });

  it('rejects an already-applied proposal instead of double-applying', () => {
    const state = sampleState();
    const originalCount = state.event.guests.count;

    const result = applyProposalsToState(state, [
      {
        id: 'p_done',
        section: 'guest',
        title: 'Previously applied change',
        description: 'Applies once only',
        afterValue: originalCount + 10,
        applied: true,
        timestamp: '',
      },
    ]);

    assert.strictEqual(result.applied.length, 0);
    assert.match(result.skipped[0].reason, /Already applied/i);
    assert.strictEqual(result.state.event.guests.count, originalCount, 'State must not change');
  });

  it('clamps out-of-range guest proposals and rejects invalid payloads', () => {
    const result = applyProposalsToState(sampleState(), [
      {
        id: 'p_zero',
        section: 'guest',
        title: 'Impossible zero guests',
        description: 'Zero',
        afterValue: 0,
        applied: false,
        timestamp: '',
      },
      {
        id: 'p_text',
        section: 'guest',
        title: 'Guest count as text',
        description: 'NaN path',
        afterValue: 'many people' as unknown as number,
        applied: false,
        timestamp: '',
      },
      {
        id: 'p_danger',
        section: 'budget',
        title: 'Budget with no allocation keys',
        description: 'Unmapped budget keys',
        afterValue: { hostingFeeAllocated: 5000 },
        applied: false,
        timestamp: '',
      },
    ]);

    assert.strictEqual(result.applied.length, 0);
    assert.strictEqual(result.skipped.length, 3);
    assert.match(result.skipped.find(s => s.id === 'p_zero')!.reason, /at least 1/i);
    assert.match(result.skipped.find(s => s.id === 'p_text')!.reason, /number/i);
    assert.match(result.skipped.find(s => s.id === 'p_danger')!.reason, /decor, catering, or photo/i);
  });

  it('throws a clear error when the state shape is unusable', () => {
    assert.throws(
      () => applyProposalsToState({ categories: null, event: null } as unknown as AppState, []),
      /Invalid application state/
    );
  });

  it('isApplicableSection matches the engine behavior', () => {
    assert.strictEqual(isApplicableSection('guest'), true);
    assert.strictEqual(isApplicableSection('budget'), true);
    assert.strictEqual(isApplicableSection('timeline'), false);
    assert.strictEqual(isApplicableSection('schedule'), false);
  });
});
