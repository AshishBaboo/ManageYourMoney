import { useRef, useState, useCallback } from 'react'

export interface Notice {
  msg: string
  ok: boolean
}

export function useNotify() {
  const [notice, setNotice] = useState<Notice | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const notify = useCallback((msg: string, ok = true) => {
    if (timer.current) clearTimeout(timer.current)
    setNotice({ msg, ok })
    timer.current = setTimeout(() => setNotice(null), 3000)
  }, [])

  return { notice, notify }
}

// Floating pill shown while a save/delete is in flight
export function BusyPill({ show, label = 'Working...' }: { show: boolean; label?: string }) {
  if (!show) return null
  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[65] flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900/90 dark:bg-gray-700 text-white text-xs shadow-lg">
      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
      {label}
    </div>
  )
}

export function Toast({ notice }: { notice: Notice | null }) {
  if (!notice) return null
  return (
    <div
      data-testid="toast"
      className={`fixed top-14 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg shadow-lg text-xs font-medium ${
        notice.ok
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
      }`}
    >
      {notice.msg}
    </div>
  )
}
