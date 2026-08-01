import { useState } from 'react'
import { Calculator, Check, X } from 'lucide-react'

// Amount input with a built-in calculator (like iSaveMoney).
// Tap the calculator icon → keypad opens seeded with the current amount →
// do the maths → ✓ puts the result back into the field.

function evaluate(expr: string): number | null {
  // tokenize: numbers and + - * /
  const tokens = expr.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g)
  if (!tokens || tokens.length === 0) return null
  // collapse leading minus into the first number
  const t: (number | string)[] = []
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (/[+\-*/]/.test(tok)) {
      if (tok === '-' && (i === 0 || /[+\-*/]/.test(tokens[i - 1]))) {
        const next = tokens[++i]
        if (next === undefined) return null
        t.push(-parseFloat(next))
      } else {
        t.push(tok)
      }
    } else {
      t.push(parseFloat(tok))
    }
  }
  if (typeof t[t.length - 1] === 'string') t.pop() // trailing operator
  // pass 1: * and /
  const p1: (number | string)[] = []
  for (let i = 0; i < t.length; i++) {
    const item = t[i]
    if (item === '*' || item === '/') {
      const prev = p1.pop() as number
      const next = t[++i] as number
      if (typeof next !== 'number') return null
      p1.push(item === '*' ? prev * next : next === 0 ? NaN : prev / next)
    } else {
      p1.push(item)
    }
  }
  // pass 2: + and -
  let result = p1[0] as number
  if (typeof result !== 'number') return null
  for (let i = 1; i < p1.length; i += 2) {
    const op = p1[i]
    const next = p1[i + 1] as number
    if (typeof next !== 'number') return null
    result = op === '+' ? result + next : result - next
  }
  if (!isFinite(result)) return null
  return Math.round(result * 100) / 100
}

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

const KEYS: { label: string; key: string }[][] = [
  [{ label: '7', key: '7' }, { label: '8', key: '8' }, { label: '9', key: '9' }, { label: '÷', key: '/' }],
  [{ label: '4', key: '4' }, { label: '5', key: '5' }, { label: '6', key: '6' }, { label: '×', key: '*' }],
  [{ label: '1', key: '1' }, { label: '2', key: '2' }, { label: '3', key: '3' }, { label: '−', key: '-' }],
  [{ label: '0', key: '0' }, { label: '.', key: '.' }, { label: '⌫', key: 'back' }, { label: '+', key: '+' }],
]

export default function AmountInput({ value, onChange, placeholder = '0', className = '', autoFocus }: AmountInputProps) {
  const [open, setOpen] = useState(false)
  const [expr, setExpr] = useState('')

  const press = (key: string) => {
    if (key === 'back') return setExpr(e => e.slice(0, -1))
    setExpr(e => e + key)
  }

  const preview = evaluate(expr)

  const apply = () => {
    const result = evaluate(expr)
    if (result !== null) onChange(String(result))
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-2.5 pr-8 py-1.5 text-base sm:text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        aria-label="Open calculator"
        onClick={() => { setExpr(value || ''); setOpen(true) }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition"
      >
        <Calculator className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-[240px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3">
            {/* display */}
            <div className="mb-2 px-2 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-right">
              <p className="text-[11px] text-gray-400 dark:text-gray-500 min-h-[14px] break-all">
                {expr.replace(/\//g, ' ÷ ').replace(/\*/g, ' × ').replace(/-/g, ' − ').replace(/\+/g, ' + ') || '0'}
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {preview !== null ? preview : ''}
              </p>
            </div>
            {/* keypad */}
            <div className="space-y-1.5">
              {KEYS.map((row, ri) => (
                <div key={ri} className="grid grid-cols-4 gap-1.5">
                  {row.map(k => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => press(k.key)}
                      className={`py-2.5 rounded-lg text-sm font-medium transition active:scale-95 ${
                        /[+\-*/]|back/.test(k.key)
                          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              ))}
              <div className="grid grid-cols-4 gap-1.5">
                <button type="button" onClick={() => setExpr('')} className="py-2.5 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/40 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/60 transition">C</button>
                <button type="button" onClick={() => { const r = evaluate(expr); if (r !== null) setExpr(String(r)) }} className="py-2.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition">=</button>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close calculator" className="py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
                <button type="button" onClick={apply} aria-label="Use result" className="py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
