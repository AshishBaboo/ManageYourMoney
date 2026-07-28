import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Plus, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { mockAccounts, mockGoals, mockTransactions, mockCategories, mockBudgets } from '../data'

const chartData = [
  { month: 'Jan', savings: 12000, expenses: 8000 },
  { month: 'Feb', savings: 15000, expenses: 9500 },
  { month: 'Mar', savings: 18000, expenses: 11000 },
  { month: 'Apr', savings: 16000, expenses: 10000 },
  { month: 'May', savings: 20000, expenses: 9000 },
  { month: 'Jun', savings: 24500, expenses: 10500 }
]

const expenseData = [
  { name: 'Groceries', value: 2800, color: '#3B82F6' },
  { name: 'Dining', value: 1200, color: '#10B981' },
  { name: 'Transportation', value: 1500, color: '#F59E0B' },
  { name: 'Utilities', value: 800, color: '#EF4444' },
  { name: 'Other', value: 900, color: '#8B5CF6' }
]

export default function Dashboard() {
  const totalBalance = mockAccounts.reduce((sum, acc) => sum + acc.balance, 0)
  const recentTransactions = mockTransactions.slice(0, 5)

  // Calculate current month budget
  const currentMonth = '2024-01'
  const currentBudgets = mockBudgets.filter(b => b.month === currentMonth)
  const totalBudget = currentBudgets.reduce((sum, b) => sum + b.limit, 0)
  const totalSpent = currentBudgets.reduce((sum, b) => sum + b.spent, 0)
  const budgetPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
  const overBudgetCount = currentBudgets.filter(b => b.spent > b.limit).length

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 md:p-8 text-white">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">Welcome back, John! 👋</h2>
        <p className="text-blue-100">Here's your financial overview for today</p>
      </div>

      {/* Total Balance Card */}
      <div className="bg-white rounded-xl shadow p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-gray-600 text-sm mb-1">Total Balance</p>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900">
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-green-600 font-semibold">
            <TrendingUp className="w-5 h-5" />
            <span>+12.5%</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {mockAccounts.map((account) => (
            <div key={account.id} className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">{account.type}</p>
              <p className="text-sm font-semibold text-gray-900">${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Savings vs Expenses */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Savings vs Expenses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip />
              <Legend />
              <Bar dataKey="savings" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expenses" fill="#EF4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={expenseData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: $${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {expenseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Monthly Budget</h3>
          <Link to="/budget" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
            View Details →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-gray-600 text-sm mb-1">Budget</p>
            <p className="text-xl font-bold text-gray-900">${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm mb-1">Spent</p>
            <p className="text-xl font-bold text-gray-900">${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm mb-1">Usage</p>
            <p className={`text-xl font-bold ${budgetPercentage > 90 ? 'text-red-600' : budgetPercentage > 75 ? 'text-yellow-600' : 'text-green-600'}`}>
              {budgetPercentage.toFixed(0)}%
            </p>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className={`h-2 rounded-full transition-all ${budgetPercentage > 90 ? 'bg-red-600' : budgetPercentage > 75 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
          />
        </div>
        {overBudgetCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">
              <span className="font-semibold">{overBudgetCount}</span> {overBudgetCount === 1 ? 'category is' : 'categories are'} over budget
            </p>
          </div>
        )}
      </div>

      {/* Goals & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Goals */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Savings Goals</h3>
            <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
              <Plus className="w-4 h-4" />
              Add Goal
            </button>
          </div>
          <div className="space-y-4">
            {mockGoals.slice(0, 3).map((goal) => {
              const progress = (goal.currentAmount / goal.targetAmount) * 100
              return (
                <div key={goal.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{goal.icon}</span>
                      <div>
                        <p className="font-semibold text-gray-900">{goal.name}</p>
                        <p className="text-xs text-gray-600">
                          ${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{Math.round(progress)}%</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`bg-gradient-to-r ${goal.color} h-2 rounded-full transition-all`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{tx.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{tx.category}</p>
                    <p className="text-xs text-gray-600">{tx.description}</p>
                  </div>
                </div>
                <p className={`font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'income' ? '+' : '-'}${Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
