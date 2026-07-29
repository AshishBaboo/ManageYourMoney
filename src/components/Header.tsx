import { Menu, Bell, Settings, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { displayName, initials } from '../lib/userData'

interface HeaderProps {
  onMenuClick: () => void
  onLogout?: () => void
  user: User | null
}

export default function Header({ onMenuClick, onLogout, user }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="px-3 md:px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onMenuClick}
            aria-label="Menu"
            className="md:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex md:hidden items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-md flex items-center justify-center text-white text-[10px] font-bold">
              MYM
            </div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
              Manage Your Money
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <div className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false) }}
              aria-label="Notifications"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition"
            >
              <Bell className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                <p className="px-3 py-1 text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700">
                  Notifications
                </p>
                <p className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                  You're all caught up 🎉
                </p>
              </div>
            )}
          </div>
          <Link
            to="/settings"
            aria-label="Settings"
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition"
          >
            <Settings className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </Link>
          <div className="relative">
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false) }}
              className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-[11px] font-semibold hover:opacity-90 transition"
              title={displayName(user)}
            >
              {initials(user)}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1.5 z-50">
                <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{displayName(user)}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    onLogout?.()
                    setShowUserMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
