import { NavLink, useNavigate } from 'react-router-dom'
import { Home, PieChart, Plus, BarChart3, Wallet } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/budget', label: 'Budget', icon: PieChart },
  null, // center + button
  { to: '/reports', label: 'Insights', icon: BarChart3 },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
]

export default function MobileNav() {
  const navigate = useNavigate()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 items-center">
        {tabs.map((tab, i) =>
          tab === null ? (
            <button
              key={i}
              onClick={() => navigate('/transactions?add=1')}
              aria-label="Add transaction"
              className="flex justify-center"
            >
              <span className="w-11 h-11 -mt-4 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-700 transition">
                <Plus className="w-5 h-5" />
              </span>
            </button>
          ) : (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-1.5 text-[10px] transition ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-500 dark:text-gray-400'
                }`
              }
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </NavLink>
          )
        )}
      </div>
    </nav>
  )
}
