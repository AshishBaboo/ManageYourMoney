import { Plus, Send, TrendingUp } from 'lucide-react'
import { mockAccounts } from '../data'

export default function Accounts(): JSX.Element {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-600 mt-1">Manage your savings and checking accounts</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Add Account</span>
        </button>
      </div>

      {/* Total Balance Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 md:p-8 text-white">
        <p className="text-blue-100 mb-2">Total Balance</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-8">
          ${mockAccounts.reduce((sum, acc) => sum + acc.balance, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white bg-opacity-20 rounded-lg backdrop-blur">
            <p className="text-sm text-blue-100 mb-1">Savings</p>
            <p className="text-xl font-bold">${(mockAccounts[0].balance + mockAccounts[2].balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="p-4 bg-white bg-opacity-20 rounded-lg backdrop-blur">
            <p className="text-sm text-blue-100 mb-1">Checking</p>
            <p className="text-xl font-bold">${mockAccounts[1].balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockAccounts.map((account) => (
          <div key={account.id} className="bg-white rounded-xl shadow hover:shadow-lg transition p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-gray-600 text-sm mb-1">Account Type</p>
                <p className="font-semibold text-gray-900 capitalize">{account.type}</p>
              </div>
              <span className="text-3xl">{account.icon}</span>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 text-sm mb-1">{account.name}</p>
              <h3 className="text-2xl font-bold text-gray-900">
                ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                <Send className="w-4 h-4" />
                Transfer
              </button>
              <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Account Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Monthly Savings Trend</h3>
          <div className="space-y-4">
            {[
              { month: 'June', amount: 2400, change: '+5.2%' },
              { month: 'May', amount: 2200, change: '+3.1%' },
              { month: 'April', amount: 1900, change: '-2.4%' },
              { month: 'March', amount: 2100, change: '+4.8%' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.month}</p>
                  <p className="text-sm text-gray-600">${item.amount}</p>
                </div>
                <p className={`flex items-center gap-1 font-semibold ${item.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  <TrendingUp className="w-4 h-4" />
                  {item.change}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Account Performance</h3>
          <div className="space-y-4">
            {mockAccounts.map((account) => (
              <div key={account.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-900">{account.name}</p>
                  <span className="text-lg">{account.icon}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(account.balance / 30000) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {Math.round((account.balance / 30000) * 100)}% of max capacity
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
