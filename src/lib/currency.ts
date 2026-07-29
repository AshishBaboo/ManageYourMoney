// Currency formatting utilities
export const CURRENCY = 'INR'
export const CURRENCY_SYMBOL = '₹'

export const formatCurrency = (amount: number): string => {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

export const formatCurrencyWithDecimals = (amount: number): string => {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
