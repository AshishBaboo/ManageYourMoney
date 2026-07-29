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
