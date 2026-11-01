import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatCurrency, formatFullNumber, parseFormattedNumber } from '../src/lib/currency.ts';

describe('Currency formatting & parsing (lakhs vs international)', () => {
  it('formats INR lakhs and crores consistently for budget arithmetic checks', () => {
    assert.strictEqual(formatCurrency(450000000, 'INR', 'lakhs'), '₹45 Cr');
    assert.strictEqual(formatCurrency(4500000, 'INR', 'lakhs'), '₹45 L');
    assert.strictEqual(formatCurrency(50000, 'INR', 'lakhs'), '₹50,000');
    assert.strictEqual(formatCurrency(-4500000, 'INR', 'lakhs'), '-₹45 L', 'Overrunning debt keeps sign');
    assert.ok(!formatCurrency(Number.NaN, 'INR', 'lakhs').includes('NaN'));
  });

  it('falls back to international formatting for non-INR currencies', () => {
    const usd = formatCurrency(4500000, 'USD', 'lakhs');
    assert.ok(/\$/.test(usd), `USD formatted: ${usd}`);
    const eur = formatCurrency(1500, 'EUR', 'international');
    assert.ok(/€/.test(eur) || /1,500/.test(eur) || /1.500/.test(eur), `EUR formatted: ${eur}`);
  });

  it('round-trips amounts through format/parse without precision drift', () => {
    const amounts = [0, 1, 999, 4500000, 450000000, 123456789];
    for (const amount of amounts) {
      const roundTrip = parseFormattedNumber(formatFullNumber(amount, 'INR', 'lakhs'));
      assert.strictEqual(roundTrip, amount, `INR full-number round trip for ${amount}`);
    }
    const usdRoundTrip = parseFormattedNumber(formatFullNumber(4500000, 'USD', 'international'));
    assert.strictEqual(usdRoundTrip, 4500000);
  });

  it('parse returns 0 for junk input, never NaN', () => {
    assert.strictEqual(parseFormattedNumber(''), 0);
    assert.strictEqual(parseFormattedNumber('not a number — void'), 0);
    assert.strictEqual(parseFormattedNumber('₹45,00,000'), 4500000);
    assert.strictEqual(parseFormattedNumber('-1,500'), -1500);
  });
});
