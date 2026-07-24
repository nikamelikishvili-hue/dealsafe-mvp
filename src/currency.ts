export const currencyCodes = [
  'USD', 'EUR', 'GBP', 'GEL', 'TRY', 'ILS', 'CNY', 'JPY', 'KRW', 'INR',
  'CAD', 'AUD', 'CHF', 'AED', 'SAR',
] as const;

export const supportedCurrencies = ['USD'] as const;

export type CurrencyCode = typeof currencyCodes[number];

const zeroDecimalCurrencies = new Set<CurrencyCode>(['JPY', 'KRW']);

export function currencyFractionDigits(currency: CurrencyCode) {
  return zeroDecimalCurrencies.has(currency) ? 0 : 2;
}

export function toMinorUnits(value: string | number, currency: CurrencyCode) {
  const amount = typeof value === 'number' ? value : Number(value);
  return Math.round(amount * 10 ** currencyFractionDigits(currency));
}

export function fromMinorUnits(value: number, currency: CurrencyCode) {
  return value / 10 ** currencyFractionDigits(currency);
}

export function amountForInput(value: number, currency: CurrencyCode) {
  return fromMinorUnits(value, currency).toFixed(currencyFractionDigits(currency));
}

export function currencyStep(currency: CurrencyCode) {
  return currencyFractionDigits(currency) === 0 ? '1' : '0.01';
}

export function formatMoney(value: number, currency: CurrencyCode, locale = 'en') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currencyFractionDigits(currency),
    maximumFractionDigits: currencyFractionDigits(currency),
  }).format(fromMinorUnits(value, currency));
}
