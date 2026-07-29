import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/currency'

export default function Dashboard(): JSX.Element {
  const [accounts, setAccounts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState('')
  const [loading, setLoading] = useState(true)
  const [_currentUser, setCurrentUser] = useState<any>(null)
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
    <div className="p-2 md:p-4 space-y-2 md:space-y-3 max-w-7xl mx-auto">
      {notification && (
        <div className="p-2 bg-green-50 border border-green-200 rounded text-green-700 text-xs">
          {notification}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded p-3">
          <p className="text-xs text-gray-600 mb-0.5">Total Balance</p>
          <p className="text-lg md:text-xl font-semibold text-blue-900">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded p-3">
          <p className="text-xs text-gray-600 mb-0.5">Income</p>
          <p className="text-lg md:text-xl font-semibold text-green-900">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded p-3">
          <p className="text-xs text-gray-600 mb-0.5">Spent</p>
          <p className="text-lg md:text-xl font-semibold text-red-900">{formatCurrency(totalSpent)}</p>
        </div>
      </div>

      {/* Accounts Section */}
      <div className="bg-white rounded border border-gray-200 p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Accounts</h2>
          <button className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-1 mb-3">
          {accounts.length === 0 ? (
            <p className="text-xs text-gray-600 py-2">No accounts yet. Add one below!</p>
          ) : (
            accounts.map(account => (
              <div key={account.id} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{account.name}</p>
                  <p className="text-xs text-gray-600">{account.type}</p>
                </div>
                <p className="text-xs font-medium text-gray-900 mr-2 whitespace-nowrap">{formatCurrency(account.balance || 0)}</p>
                <button
                  onClick={() => deleteAccount(account.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="Name"
            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="number"
            value={newAccountBalance}
            onChange={(e) => setNewAccountBalance(e.target.value)}
            placeholder="Balance"
            className="w-20 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={addAccount}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
          >
            Add
          </button>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="bg-white rounded border border-gray-200 p-3">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Monthly Budget</h2>
        <div className="space-y-2">
          {budgets.length === 0 ? (
            <p className="text-xs text-gray-600 py-2">No budgets set yet</p>
          ) : (
            budgets.map(budget => {
              const percentage = (budget.spent / budget.limit) * 100
              const color = percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
              return (
                <div key={budget.id} className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-medium text-gray-900">{budget.category}</p>
                    <p className="text-xs text-gray-600">{formatCurrency(budget.spent)} / {formatCurrency(budget.limit)}</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded border border-gray-200 p-3">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Recent Transactions</h2>
        <div className="space-y-1">
          {transactions.length === 0 ? (
            <p className="text-xs text-gray-600 py-2">No transactions yet</p>
          ) : (
            transactions.slice(0, 10).map(transaction => (
              <div key={transaction.id} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{transaction.description}</p>
                  <p className="text-xs text-gray-600">{transaction.date} • {transaction.category}</p>
                </div>
                <p className={`text-xs font-medium ml-1 whitespace-nowrap ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {transaction.amount > 0 ? '+' : ''} {formatCurrency(Math.abs(transaction.amount))}
                </p>
                <button
                  onClick={() => deleteTransaction(transaction.id)}
                  className="p-1 ml-1 text-red-600 hover:bg-red-50 rounded transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Attribution */}
      <div className="text-center pt-2 border-t border-gray-200">
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
