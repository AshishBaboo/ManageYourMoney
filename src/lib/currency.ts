// Currency preference — INR by default, changeable in Settings
export const CURRENCIES: Record<string, { symbol: string; label: string; locale: string }> = {
  INR: { symbol: '₹', label: 'INR - Indian Rupee', locale: 'en-IN' },
  USD: { symbol: '$', label: 'USD - US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', label: 'EUR - Euro', locale: 'de-DE' },
  GBP: { symbol: '£', label: 'GBP - British Pound', locale: 'en-GB' },
  CAD: { symbol: 'C$', label: 'CAD - Canadian Dollar', locale: 'en-CA' },
}

const KEY = 'mym_currency'

export function getCurrency(): string {
  const c = localStorage.getItem(KEY)
  return c && CURRENCIES[c] ? c : 'INR'
}

export function setCurrency(code: string): void {
  if (CURRENCIES[code]) localStorage.setItem(KEY, code)
}

export function currencySymbol(): string {
  return CURRENCIES[getCurrency()].symbol
}

export function formatCurrency(amount: number): string {
  const { symbol, locale } = CURRENCIES[getCurrency()]
  return `${symbol}${(amount || 0).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}
