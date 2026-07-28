import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Wallet, ArrowRightLeft, PieChart, Target, Settings, LogOut, X } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Accounts', icon: Wallet, href: '/accounts' },
  { label: 'Transactions', icon: ArrowRightLeft, href: '/transactions' },
  { label: 'Budget', icon: PieChart, href: '/budget' },
  { label: 'Goals', icon: Target, href: '/goals' },
  { label: 'Settings', icon: Settings, href: '/settings' }
]

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [activeItem, setActiveItem] = useState('/')

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
        className={`fixed md:static left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-300 z-40 md:z-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold">
                iS
              </div>
              <span className="font-bold text-gray-900 hidden md:inline">iSaveMoney</span>
            </div>
            <button
              onClick={onClose}
              className="md:hidden p-1 hover:bg-gray-100 rounded transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => {
                  setActiveItem(item.href)
                  onClose()
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  activeItem === item.href
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
