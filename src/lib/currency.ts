import { CurrencyCode, CURRENCY_CONFIGS } from '../types/currency';

export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode = 'INR',
  formatPreference: 'lakhs' | 'international' = 'lakhs'
): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    amount = 0;
  }

  const config = CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.INR;

  if (currencyCode === 'INR' && formatPreference === 'lakhs') {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';

    if (abs >= 10000000) {
      // 1 Crore = 10,000,000
      const cr = (abs / 10000000).toFixed(2);
      return `${sign}₹${parseFloat(cr)} Cr`;
    } else if (abs >= 100000) {
      // 1 Lakh = 100,000
      const lk = (abs / 100000).toFixed(2);
      return `${sign}₹${parseFloat(lk)} L`;
    } else {
      // Standard Indian comma grouping (e.g. 50,000)
      return `${sign}₹${abs.toLocaleString('en-IN')}`;
    }
  }

  // International standard formatting
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${config.symbol}${amount.toLocaleString()}`;
  }
}

export function formatFullNumber(
  amount: number,
  currencyCode: CurrencyCode = 'INR',
  formatPreference: 'lakhs' | 'international' = 'lakhs'
): string {
  if (isNaN(amount)) amount = 0;
  const config = CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.INR;

  if (currencyCode === 'INR' && formatPreference === 'lakhs') {
    return `${config.symbol}${amount.toLocaleString('en-IN')}`;
  }
  return `${config.symbol}${amount.toLocaleString('en-US')}`;
}

export function parseFormattedNumber(input: string): number {
  if (!input) return 0;
  // Clean currency symbols, commas, spaces
  const clean = input.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}
