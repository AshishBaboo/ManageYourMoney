import { useRef, useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import { formatDate, parseDisplayDate, displayPlaceholder } from '../lib/dateFormat'

// Date field that always shows the user's chosen format (DD/MM/YYYY by
// default) instead of the browser's locale. Value in/out is ISO yyyy-MM-dd.
// The calendar button opens the native picker for tapping a day.

interface DateInputProps {
  value: string
  onChange: (isoDate: string) => void
  className?: string
}

export default function DateInput({ value, onChange, className = '' }: DateInputProps) {
  const [text, setText] = useState(() => (value ? formatDate(value) : ''))
  const nativeRef = useRef<HTMLInputElement>(null)

  // keep the visible text in sync when the value changes elsewhere
  useEffect(() => {
    setText(value ? formatDate(value) : '')
  }, [value])

  const commit = (raw: string) => {
    const iso = parseDisplayDate(raw)
    if (iso) onChange(iso)
    else setText(value ? formatDate(value) : '') // revert bad input
  }

  const openPicker = () => {
    const el = nativeRef.current
    if (!el) return
    // showPicker is supported on modern browsers; fall back to focus+click
    if (typeof (el as any).showPicker === 'function') (el as any).showPicker()
    else el.click()
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }}
        placeholder={displayPlaceholder()}
        className="w-full pl-2.5 pr-8 py-1.5 text-base sm:text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        aria-label="Pick a date"
        onClick={openPicker}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition"
      >
        <Calendar className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {/* hidden native picker drives the value on tap */}
      <input
        ref={nativeRef}
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute right-2 bottom-0 w-px h-px opacity-0 pointer-events-none"
      />
    </div>
  )
}
