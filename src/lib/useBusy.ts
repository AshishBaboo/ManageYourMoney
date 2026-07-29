import { useRef, useState, useCallback } from 'react'

// Prevents double-submits: wrap any async action with run(). While it runs,
// `busy` is true (disable the button, show "Saving...") and re-entry is blocked.
export function useBusy() {
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  const run = useCallback(async (fn: () => Promise<unknown> | unknown) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      await fn()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }, [])

  return { busy, run }
}
