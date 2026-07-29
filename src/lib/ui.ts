// Shared compact, theme-aware UI class tokens — keep every page consistent
export const ui = {
  page: 'p-3 md:p-4 space-y-3 max-w-6xl mx-auto pb-8',
  card: 'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3',
  h1: 'text-lg font-semibold text-gray-900 dark:text-white',
  h2: 'text-sm font-semibold text-gray-900 dark:text-white',
  sub: 'text-xs text-gray-500 dark:text-gray-400',
  text: 'text-xs text-gray-700 dark:text-gray-300',
  strong: 'text-xs font-medium text-gray-900 dark:text-white',
  label: 'block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1',
  input:
    'w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
  select:
    'mym-select w-full px-2.5 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer',
  btnPrimary:
    'px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed',
  btnSecondary:
    'px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition',
  btnDanger:
    'px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition',
  row: 'flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition',
  iconBtn: 'p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition',
  iconBtnDanger: 'p-1.5 text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition',
  empty: 'text-xs text-gray-500 dark:text-gray-400 py-3 text-center',
  progressTrack: 'w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5',
}
