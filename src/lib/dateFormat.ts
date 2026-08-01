import { format as fmt, parse as parseFn, isValid } from 'date-fns'

// Date display preference. Stored values are always ISO (yyyy-MM-dd) —
// only the presentation changes, so existing data renders correctly.
export const DATE_FORMATS: Record<string, { pattern: string; label: string }> = {
  'dd/MM/yyyy': { pattern: 'dd/MM/yyyy', label: 'DD/MM/YYYY  (31/12/2026)' },
  'MM/dd/yyyy': { pattern: 'MM/dd/yyyy', label: 'MM/DD/YYYY  (12/31/2026)' },
  'dd-MMM-yyyy': { pattern: 'dd-MMM-yyyy', label: 'DD-MMM-YYYY  (31-Dec-2026)' },
  'yyyy-MM-dd': { pattern: 'yyyy-MM-dd', label: 'YYYY-MM-DD  (2026-12-31)' },
}

const KEY = 'mym_date_format'

export function getDateFormat(): string {
  const f = localStorage.getItem(KEY)
  return f && DATE_FORMATS[f] ? f : 'dd/MM/yyyy'
}

export function setDateFormat(pattern: string): void {
  if (DATE_FORMATS[pattern]) localStorage.setItem(KEY, pattern)
}

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return isValid(value) ? value : null
  if (!value) return null
  // ISO date (yyyy-MM-dd) or full timestamp
  const d = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  return isValid(d) ? d : null
}

/** Format any stored date for display, e.g. 31/12/2026 */
export function formatDate(value: string | Date): string {
  const d = toDate(value)
  return d ? fmt(d, getDateFormat()) : ''
}

/** Format with time, e.g. 31/12/2026 03:54 PM */
export function formatDateTime(value: string | Date): string {
  const d = toDate(value)
  return d ? fmt(d, `${getDateFormat()} hh:mm a`) : ''
}

/** Parse what the user typed (in their chosen format) back to ISO yyyy-MM-dd */
export function parseDisplayDate(text: string): string | null {
  const pattern = getDateFormat()
  const d = parseFn(text, pattern, new Date())
  if (!isValid(d)) return null
  return fmt(d, 'yyyy-MM-dd')
}

export const displayPlaceholder = () => getDateFormat().toUpperCase()
