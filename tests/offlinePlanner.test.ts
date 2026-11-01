import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runOfflinePlanner } from '../src/lib/offlinePlanner.ts';
import { createSampleWedding } from '../src/lib/sampleEvents.ts';
import type { AppState } from '../src/types/index.ts';

/**
 * The offline expert must replan guest headcount in BOTH directions. The
 * expansion path existed first; a prompt like "reduce guest count to 90" used
 * to fall through to the generic status summary without staging any proposal —
 * even though the planner advertises "changing headcount" support.
 */
function wedding(): AppState {
  return createSampleWedding();
}

describe('Offline planner guest-headcount intents', () => {
  it('stages a reduction proposal for "reduce guest count to 90" without expansion reallocations', () => {
    const state = wedding();
    const response = runOfflinePlanner('Reduce guest count to 90', state);

    assert.ok(response, 'Reduction prompt must produce a structured response');
    assert.ok(response.message.includes('90'), 'Message acknowledges the new count');
    assert.strictEqual(response.proposed_changes.length, 1, 'Only the headcount change is proposed');
    const proposal = response.proposed_changes[0];
    assert.strictEqual(proposal.section, 'guest');
    assert.strictEqual(proposal.beforeValue, state.event.guests.count);
    assert.strictEqual(proposal.afterValue, 90);
    assert.ok(
      !response.proposed_changes.some(p => p.title.includes('Reallocate Decor')),
      'Expansion-only decor→catering reallocation must not appear for a reduction'
    );
  });

  it('still stages the expansion response with trade-off reallocations', () => {
    const state = wedding();
    const response = runOfflinePlanner('Increase guest count to 300', state);

    assert.ok(response, 'Expansion prompt must produce a structured response');
    assert.ok(response.message.toLowerCase().includes('expanded'), 'Expansion message unmodified');
    assert.ok(response.proposed_changes.length >= 1, 'Headcount change proposed');
    assert.strictEqual(response.proposed_changes[0].section, 'guest');
    assert.strictEqual(response.proposed_changes[0].afterValue, 300);
  });

  it('does not invent a headcount proposal when no guest count is mentioned', () => {
    const state = wedding();
    const response = runOfflinePlanner('Reduce food cost', state);

    // "reduce" alone with no countable guest target falls through to the
    // budget-leak / generic branches, never to a fabricated guest change.
    if (response) {
      assert.ok(
        !response.proposed_changes.some(p => p.section === 'guest'),
        'No guest proposal without a guest number in the prompt'
      );
    }
  });
});
