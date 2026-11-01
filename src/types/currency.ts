/**
 * Display preference for amounts: `'lakhs'` renders INR in the Indian
 * thousands system (₹45 L, ₹1.5 Cr) while `'international'` always uses
 * `Intl.NumberFormat` with the currency's locale.
 *
 * Canonical source for the union; previously the same two-literal union was
 * inlined at ~10 call sites (types/event.ts, lib/currency.ts×2, lib/storage.ts,
 * components/AdaptiveSetupModal.tsx×4, components/settings/SettingsTab.tsx×3).
 */
export type NumberFormat = 'lakhs' | 'international';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'CAD' | 'AUD' | 'SGD';

/** Canonical order of supported currency codes, for type-safe coercion of untrusted input. */
export const CURRENCY_CODES: readonly CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'SGD'];

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
  defaultFormat: NumberFormat;
  rateToInr: number; // approximate benchmark for conversion
}

export const CURRENCY_CONFIGS: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', defaultFormat: 'lakhs', rateToInr: 1 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', defaultFormat: 'international', rateToInr: 85 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', defaultFormat: 'international', rateToInr: 92 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', defaultFormat: 'international', rateToInr: 110 },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham', locale: 'ar-AE', defaultFormat: 'international', rateToInr: 23 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA', defaultFormat: 'international', rateToInr: 62 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', defaultFormat: 'international', rateToInr: 55 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', defaultFormat: 'international', rateToInr: 64 },
};
