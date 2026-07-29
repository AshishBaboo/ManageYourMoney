export default function Loader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2" data-testid="loader">
      <div className="w-7 h-7 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}
