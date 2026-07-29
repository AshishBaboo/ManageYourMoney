import { useState, useCallback, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

// useConfirm(): promise-based confirmation modal for destructive actions.
//   const { confirm, confirmDialog } = useConfirm()
//   if (!(await confirm('Delete account "HDFC"?'))) return
// Render {confirmDialog} once in the page.
export function useConfirm() {
  const [state, setState] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null)

  const confirm = useCallback(
    (message: string) => new Promise<boolean>(resolve => setState({ message, resolve })),
    []
  )

  const close = (ok: boolean) => {
    state?.resolve(ok)
    setState(null)
  }

  const confirmDialog: ReactNode = state ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => close(false)} />
      <div className="relative w-full max-w-xs bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Are you sure?</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{state.message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => close(true)}
            className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition"
          >
            Delete
          </button>
          <button
            onClick={() => close(false)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, confirmDialog }
}
