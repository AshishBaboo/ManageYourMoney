import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Wallet, ArrowRightLeft, PieChart, Target, Settings, LogOut, X, BarChart3 } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onLogout?: () => void
}

const menuItems = [
  { label: 'Budget', icon: PieChart, href: '/budget' },
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Transactions', icon: ArrowRightLeft, href: '/transactions' },
  { label: 'Insights', icon: BarChart3, href: '/reports' },
  { label: 'Accounts', icon: Wallet, href: '/accounts' },
  { label: 'Goals', icon: Target, href: '/goals' },
  { label: 'Settings', icon: Settings, href: '/settings' }
]

export default function Sidebar({ isOpen, onClose, onLogout }: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-30"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static left-0 top-0 h-screen w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 z-40 md:z-0 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 flex-1">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-md flex items-center justify-center text-white text-[10px] font-bold">
                MYM
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Manage Your Money</span>
            </div>
            <button
              onClick={onClose}
              className="md:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
            >
              <X className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition ${
                  location.pathname === item.href
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
