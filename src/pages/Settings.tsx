import { useState } from 'react'
import { Bell, Lock, Eye, Smartphone, LogOut, ChevronRight, Save } from 'lucide-react'

export default function Settings() {
  const [settings, setSettings] = useState({
    notifications: true,
    emailAlerts: true,
    pushNotifications: true,
    twoFactor: false,
    darkMode: false,
    currency: 'USD'
  })

  const handleToggle = (key: keyof typeof settings) => {
    setSettings({
      ...settings,
      [key]: typeof settings[key] === 'boolean' ? !settings[key] : settings[key]
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Profile</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              JD
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">John Doe</h3>
              <p className="text-gray-600">john@example.com</p>
              <button className="text-blue-600 hover:text-blue-700 font-medium text-sm mt-1">
                Edit Profile
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                defaultValue="John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                defaultValue="john@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Email Notifications</p>
              <p className="text-sm text-gray-600">Receive updates about your account</p>
            </div>
            <button
              onClick={() => handleToggle('emailAlerts')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                settings.emailAlerts ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.emailAlerts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Push Notifications</p>
              <p className="text-sm text-gray-600">Get alerts on your device</p>
            </div>
            <button
              onClick={() => handleToggle('pushNotifications')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                settings.pushNotifications ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.pushNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">Security</h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <button className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition">
            <div className="text-left">
              <p className="font-medium text-gray-900">Change Password</p>
              <p className="text-sm text-gray-600">Update your password regularly</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Two-Factor Authentication</p>
              <p className="text-sm text-gray-600">Add extra security to your account</p>
            </div>
            <button
              onClick={() => handleToggle('twoFactor')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                settings.twoFactor ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.twoFactor ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <button className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition">
            <div className="text-left">
              <p className="font-medium text-gray-900">Connected Devices</p>
              <p className="text-sm text-gray-600">Manage your login sessions</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Preferences</h2>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Currency
            </label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>USD - US Dollar</option>
              <option>EUR - Euro</option>
              <option>GBP - British Pound</option>
              <option>CAD - Canadian Dollar</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Theme
            </label>
            <div className="flex gap-4">
              <button className="px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg font-medium">
                Light
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400">
                Dark
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-red-600">Danger Zone</h2>
        </div>
        <div className="p-6 space-y-3">
          <button className="w-full flex items-center gap-3 px-4 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition font-medium">
            <LogOut className="w-5 h-5" />
            Sign Out from All Devices
          </button>
          <button className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium border border-red-300">
            Delete Account
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-4">
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
          <Save className="w-5 h-5" />
          Save Changes
        </button>
        <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold">
          Cancel
        </button>
      </div>
    </div>
  )
}
