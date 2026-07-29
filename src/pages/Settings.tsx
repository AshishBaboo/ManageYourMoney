import { useEffect, useState } from 'react'
import { Lock, LogOut, Save, Sun, Moon } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { CURRENCIES, getCurrency, setCurrency } from '../lib/currency'
import { getTheme, applyTheme, Theme } from '../lib/theme'
import { displayName, initials } from '../lib/userData'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'

export default function Settings(): JSX.Element {
  const [user, setUser] = useState<User | null>(null)
  const [fullName, setFullName] = useState('')
  const [theme, setThemeState] = useState<Theme>(getTheme())
  const [currency, setCurrencyState] = useState(getCurrency())
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const { notice, notify } = useNotify()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u)
      setFullName((u?.user_metadata?.full_name as string) || '')
    })
  }, [])

  const saveProfile = async () => {
    if (!fullName.trim()) return notify('Enter your name', false)
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } })
      if (error) throw error
      await supabase.from('users').upsert(
        { id: user?.id, email: user?.email, full_name: fullName.trim() },
        { onConflict: 'id' }
      )
      notify('Profile saved')
    } catch (e: any) {
      notify(e.message || 'Failed to save profile', false)
    } finally {
      setSaving(false)
    }
  }

  const changeTheme = (t: Theme) => {
    applyTheme(t)
    setThemeState(t)
    notify(`${t === 'dark' ? 'Dark' : 'Light'} theme applied`)
  }

  const changeCurrency = (code: string) => {
    setCurrency(code)
    setCurrencyState(code)
    notify(`Currency set to ${code} (${CURRENCIES[code].symbol})`)
  }

  const changePassword = async () => {
    if (newPassword.length < 6) return notify('Password must be at least 6 characters', false)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      notify('Password updated')
    } catch (e: any) {
      notify(e.message || 'Failed to update password', false)
    }
  }

  const signOutEverywhere = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch (e: any) {
      notify(e.message || 'Failed to sign out', false)
    }
  }

  return (
    <div className={`${ui.page} max-w-2xl`}>
      <Toast notice={notice} />

      <div>
        <h1 className={ui.h1}>Settings</h1>
        <p className={ui.sub}>Your account and preferences</p>
      </div>

      {/* Profile */}
      <div className={ui.card}>
        <h2 className={`${ui.h2} mb-2`}>Profile</h2>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {initials(user)}
          </div>
          <div className="min-w-0">
            <p className={ui.strong}>{displayName(user)}</p>
            <p className={ui.sub}>{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className={ui.label}>Full Name</label>
            <input className={ui.input} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
          </div>
          <button onClick={saveProfile} disabled={saving} className={ui.btnPrimary}>
            <span className="flex items-center gap-1"><Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className={ui.card}>
        <h2 className={`${ui.h2} mb-2`}>Preferences</h2>
        <div className="space-y-3">
          <div>
            <label className={ui.label}>Theme</label>
            <div className="flex gap-2">
              <button
                onClick={() => changeTheme('light')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition ${
                  theme === 'light'
                    ? 'border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Sun className="w-3.5 h-3.5" /> Light
              </button>
              <button
                onClick={() => changeTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition ${
                  theme === 'dark'
                    ? 'border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Moon className="w-3.5 h-3.5" /> Dark
              </button>
            </div>
          </div>
          <div>
            <label className={ui.label}>Currency</label>
            <select className={ui.select} value={currency} onChange={e => changeCurrency(e.target.value)}>
              {Object.entries(CURRENCIES).map(([code, c]) => (
                <option key={code} value={code}>{c.label}</option>
              ))}
            </select>
            <p className={`${ui.sub} mt-1`}>Applies everywhere amounts are shown. Default is INR (₹).</p>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className={ui.card}>
        <div className="flex items-center gap-1.5 mb-2">
          <Lock className="w-3.5 h-3.5 text-green-600" />
          <h2 className={ui.h2}>Security</h2>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className={ui.label}>New Password</label>
            <input
              className={ui.input}
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <button onClick={changePassword} className={ui.btnPrimary}>Update</button>
        </div>
        <button onClick={signOutEverywhere} className={`${ui.btnDanger} mt-3 w-full`}>
          <span className="flex items-center justify-center gap-1.5"><LogOut className="w-3.5 h-3.5" /> Sign Out from All Devices</span>
        </button>
      </div>

      {/* Attribution */}
      <div className="text-center pt-2">
        <p className={ui.sub}>
          Developed by{' '}
          <a href="https://ashishbaboo.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
            Ashish Baboo
          </a>
        </p>
      </div>
    </div>
  )
}
