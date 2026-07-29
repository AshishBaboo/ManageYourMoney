import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  group?: string
  hint?: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

// Fully-styled dropdown (native <select> popups can't be themed)
export default function Select({ value, onChange, options, placeholder = 'Select', className = '', disabled }: SelectProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const selected = options.find(o => o.value === value)

  // group options preserving order
  const groups: { name: string | undefined; items: SelectOption[] }[] = []
  for (const o of options) {
    const last = groups[groups.length - 1]
    if (last && last.name === o.group) last.items.push(o)
    else groups.push({ name: o.group, items: [o] })
  }

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-sm text-left border rounded-lg transition
          bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600
          hover:border-gray-400 dark:hover:border-gray-500
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${open ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
      >
        <span className={`truncate ${selected ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {options.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">No options</p>
            )}
            {groups.map((g, gi) => (
              <div key={gi}>
                {g.name && (
                  <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {g.name}
                  </p>
                )}
                {g.items.map(o => {
                  const isSel = o.value === value
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => { onChange(o.value); setOpen(false) }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition ${
                        isSel
                          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                      } ${g.name ? 'pl-5' : ''}`}
                    >
                      <span className="truncate">
                        {o.label}
                        {o.hint && <span className="ml-1 text-[10px] text-gray-400">{o.hint}</span>}
                      </span>
                      {isSel && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
