import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  coerceAppState,
  validateAndImportState,
} from '../src/lib/storage.ts';
import { createSampleWedding } from '../src/lib/sampleEvents.ts';

const sampleState = () => createSampleWedding();

describe('Backup Import (ImportResult contract)', () => {
  it('imports a valid sample backup successfully', () => {
    const result = validateAndImportState(JSON.stringify(sampleState()));
    assert.strictEqual(result.success, true, 'Sample state must import');
    if (!result.success) return; // TS narrowing helper
    assert.strictEqual(result.state.event.title, sampleState().event.title);
    assert.ok(Array.isArray(result.state.categories));
    assert.ok(result.state.categories.length > 0);
  });

  it('returns a typed failure for empty / huge / invalid JSON without throwing', () => {
    const empty = validateAndImportState('');
    assert.strictEqual(empty.success, false);
    assert.match(empty.error!, /file is empty/i);

    const huge = validateAndImportState('x'.repeat(6 * 1024 * 1024));
    assert.strictEqual(huge.success, false);
    assert.match(huge.error!, /too large/i);

    const broken = validateAndImportState('{ not json');
    assert.strictEqual(broken.success, false);
    assert.match(broken.error!, /Invalid JSON file syntax/i);
  });

  it('rejects prototype-pollution payloads — never succeeds, never pollutes', () => {
    // Handcrafted JSON so the "__proto__" key actually reaches the parser
    // (JSON.stringify would silently drop it from an object literal).
    const polluted = '{"__proto__": {"injected": true}, "event": {"title": "Evil", "type": "wedding"}, "categories": []}';
    const result = validateAndImportState(polluted);
    assert.strictEqual(result.success, false, 'Unsafe keys must be refused');
    assert.match(result.error!, /Unsafe property "__proto__"/i);

    const nested = '{"event": {"title": "Evil", "type": "wedding", "__proto__": {"admin": true}}, "categories": []}';
    const nestedResult = validateAndImportState(nested);
    assert.strictEqual(nestedResult.success, false, 'Nested unsafe keys are refused too');

    // A proof the global prototype stayed clean:
    const probe: Record<string, unknown> = {};
    assert.strictEqual(probe.injected, undefined, 'Object.prototype untouched');
  });

  it('fails with a clear message when core metadata is missing', () => {
    const onlyBudget = JSON.stringify({ budget: { total: 100 } });
    const result = validateAndImportState(onlyBudget);
    assert.strictEqual(result.success, false);
    assert.match(result.error!, /core event metadata/i);

    const bareTitle = JSON.stringify({ event: { title: 'No data' } });
    const second = validateAndImportState(bareTitle);
    assert.strictEqual(second.success, false, 'Type-less event rejected');

    // A state with a missing categories list still coerces to a safe empty
    // roster rather than being rejected as a whole file.
    const withoutCategories = validateAndImportState('{"event": {"title": "Valid Event", "type": "wedding"}}');
    assert.strictEqual(withoutCategories.success, true);
    if (withoutCategories.success) {
      assert.deepStrictEqual(withoutCategories.state.categories, []);
    }
  });
});

describe('coerceAppState sanitization', () => {
  it('clamps hostile numbers and depths safely', () => {
    const hostile = {
      event: {
        title: 'Big'.repeat(5000),
        type: 'wedding',
        durationDays: 99,
        guests: { count: 999999999, bufferPercent: -50, expectedAttendance: -1 },
        budget: { total: -12345678, currency: 'EUR', numberFormat: 'international' },
      },
      categories: [
        { id: 'c1', name: 'Catering', allocationPercent: 999, allocatedAmount: -50 },
        Array(5000).fill('x'),
      ],
      tasks: Array.from({ length: 7000 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}` })),
      deep: { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: { l: { m: 1 } } } } } } } } } } } } },
      junk: () => 'nope',
    };

    const state = coerceAppState(hostile);
    assert.ok(state, 'Well-shaped envelope still coerces');
    assert.ok(state.event.title.length <= 500, `Title truncated, got ${state.event.title.length}`);
    assert.ok(state.event.durationDays >= 1 && state.event.durationDays <= 30);
    assert.ok(state.event.guests.count >= 0 && state.event.guests.count <= 1000000);
    assert.strictEqual(state.event.budget.total, 0, 'Negative budget zeroed');
    assert.ok(state.tasks.length <= 2000, `Collections capped, got ${state.tasks.length}`);
  });

  it('returns null for non-object input', () => {
    assert.strictEqual(coerceAppState(null), null);
    assert.strictEqual(coerceAppState('nope'), null);
    assert.strictEqual(coerceAppState(42), null);
    assert.strictEqual(coerceAppState(['array', 'not', 'object']), null);
  });

  it('validates untrusted type and currency strings against the canonical lists', () => {
    const forgedType = coerceAppState({ event: { title: 'Forged', type: 'salsa' } });
    assert.ok(forgedType, 'Forged-type event still coerces (only missing type is rejected)');
    if (forgedType) {
      assert.strictEqual(forgedType.event.type, 'custom', 'Unrecognized type normalizes to custom');
    }

    const forgedCurrency = coerceAppState({
      event: { title: 'X', type: 'wedding', budget: { total: 100, currency: 'ZZZ' } },
    });
    assert.ok(forgedCurrency);
    if (forgedCurrency) {
      assert.strictEqual(forgedCurrency.event.budget.currency, 'INR', 'Unknown currency code falls back to INR');
    }

    const trimmableCurrency = coerceAppState({
      event: { title: 'X', type: 'wedding', budget: { total: 100, currency: ' usd ' } },
    });
    assert.ok(trimmableCurrency);
    if (trimmableCurrency) {
      assert.strictEqual(trimmableCurrency.event.budget.currency, 'USD', 'Padded/cased codes still match');
    }
  });
});
