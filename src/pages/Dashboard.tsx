import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard(): JSX.Element {
  const [accounts, setAccounts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [notification, setNotification] = useState('')

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser(user)
        // Load accounts
        const { data: accData } = await supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
        setAccounts(accData || [])

        // Load transactions
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
        setTransactions(txData || [])

        // Load budgets
        const { data: budData } = await supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id)
        setBudgets(budData || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addAccount = async () => {
    if (!newAccountName || !newAccountBalance) {
      setNotification('Please fill in all fields')
      setTimeout(() => setNotification(''), 3000)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          name: newAccountName,
          balance: parseFloat(newAccountBalance),
          type: 'Bank'
        })
        .select()

      if (error) throw error
      if (data) {
        setAccounts([...accounts, data[0]])
        setNewAccountName('')
        setNewAccountBalance('')
        setNotification('Account added successfully!')
        setTimeout(() => setNotification(''), 3000)
      }
    } catch (error) {
      console.error('Error adding account:', error)
      setNotification('Failed to add account')
      setTimeout(() => setNotification(''), 3000)
    }
  }

  const deleteAccount = async (id: string) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id)

      if (error) throw error
      setAccounts(accounts.filter(a => a.id !== id))
      setNotification('Account deleted successfully!')
      setTimeout(() => setNotification(''), 3000)
    } catch (error) {
      console.error('Error deleting account:', error)
      setNotification('Failed to delete account')
      setTimeout(() => setNotification(''), 3000)
    }
  }

  const deleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

      if (error) throw error
      setTransactions(transactions.filter(t => t.id !== id))
      setNotification('Transaction deleted!')
      setTimeout(() => setNotification(''), 3000)
    } catch (error) {
      console.error('Error deleting transaction:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading your data...</p>
      </div>
    )
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const totalSpent = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const totalIncome = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {notification && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {notification}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-600 mb-1">Total Balance</p>
          <p className="text-2xl md:text-3xl font-bold text-blue-900">${totalBalance.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-600 mb-1">Income</p>
          <p className="text-2xl md:text-3xl font-bold text-green-900">${totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-600 mb-1">Spent</p>
          <p className="text-2xl md:text-3xl font-bold text-red-900">${totalSpent.toLocaleString()}</p>
        </div>
      </div>

      {/* Accounts Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">Accounts</h2>
          <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {accounts.length === 0 ? (
            <p className="text-sm text-gray-600 py-4">No accounts yet. Add one below!</p>
          ) : (
            accounts.map(account => (
              <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                <div className="flex-1">
                  <p className="text-sm md:text-base font-medium text-gray-900">{account.name}</p>
                  <p className="text-xs md:text-sm text-gray-600">{account.type}</p>
                </div>
                <p className="text-sm md:text-base font-bold text-gray-900 mr-3">${(account.balance || 0).toLocaleString()}</p>
                <button
                  onClick={() => deleteAccount(account.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="Account name"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            value={newAccountBalance}
            onChange={(e) => setNewAccountBalance(e.target.value)}
            placeholder="Balance"
            className="w-24 md:w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addAccount}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Add
          </button>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Monthly Budget</h2>
        <div className="space-y-3">
          {budgets.length === 0 ? (
            <p className="text-sm text-gray-600 py-4">No budgets set yet</p>
          ) : (
            budgets.map(budget => {
              const percentage = (budget.spent / budget.limit) * 100
              const color = percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
              return (
                <div key={budget.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-900">{budget.category}</p>
                    <p className="text-xs md:text-sm text-gray-600">${budget.spent} / ${budget.limit}</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">Recent Transactions</h2>
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-600 py-4">No transactions yet</p>
          ) : (
            transactions.slice(0, 10).map(transaction => (
              <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm md:text-base font-medium text-gray-900 truncate">{transaction.description}</p>
                  <p className="text-xs md:text-sm text-gray-600">{transaction.date} • {transaction.category}</p>
                </div>
                <p className={`text-sm md:text-base font-bold ml-2 whitespace-nowrap ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {transaction.amount > 0 ? '+' : ''} ${Math.abs(transaction.amount).toLocaleString()}
                </p>
                <button
                  onClick={() => deleteTransaction(transaction.id)}
                  className="p-1.5 ml-2 text-red-600 hover:bg-red-50 rounded transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Attribution */}
      <div className="text-center pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Developed by{' '}
          <a href="https://ashishbaboo.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Ashish Baboo
          </a>
        </p>
      </div>
    </div>
  )
}
