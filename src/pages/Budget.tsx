import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { mockCategories, mockBudgets, mockTransactions } from '../data'
import { format, addMonths, subMonths } from 'date-fns'

export default function Budget() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2024, 0, 1))
  const monthStr = format(currentMonth, 'yyyy-MM')

  const currentBudgets = mockBudgets.filter(b => b.month === monthStr)
  const currentTransactions = mockTransactions.filter(tx => tx.date.startsWith(monthStr))

  // Calculate spending by category
  const categorySpending = mockCategories
    .filter(cat => cat.type === 'expense')
    .map(category => {
      const budget = currentBudgets.find(b => b.categoryId === category.id)
      const spent = currentTransactions
        .filter(tx => tx.category === category.name && tx.type === 'expense')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

      const limit = budget?.limit || category.budgetLimit || 0
      const remaining = limit - spent
      const percentage = limit > 0 ? (spent / limit) * 100 : 0

      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        spent,
        limit,
        remaining,
        percentage,
        color: category.color,
        isOver: spent > limit
      }
    })

  const totalBudget = categorySpending.reduce((sum, c) => sum + c.limit, 0)
  const totalSpent = categorySpending.reduce((sum, c) => sum + c.spent, 0)
  const totalRemaining = totalBudget - totalSpent
  const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  const chartData = categorySpending.map(c => ({
    name: c.name,
    Budget: c.limit,
    Spent: c.spent,
    Remaining: Math.max(0, c.remaining)
  }))

  const overBudgetCategories = categorySpending.filter(c => c.isOver)

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget Tracker</h1>
          <p className="text-gray-600 mt-1">Track your spending against budgets</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New Category</span>
        </button>
      </div>

      {/* Month Selector */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex items-center justify-between">
          <button onClick={previousMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Overall Budget Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 md:p-8 text-white">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-blue-100 mb-2">Total Budget</p>
            <h3 className="text-3xl font-bold">${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div>
            <p className="text-blue-100 mb-2">Total Spent</p>
            <h3 className="text-3xl font-bold">${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div>
            <p className="text-blue-100 mb-2">Remaining</p>
            <h3 className={`text-3xl font-bold ${totalRemaining < 0 ? 'text-red-300' : 'text-green-300'}`}>
              ${totalRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div>
            <p className="text-blue-100 mb-2">Usage</p>
            <h3 className="text-3xl font-bold">{overallPercentage.toFixed(1)}%</h3>
          </div>
        </div>
        <div className="mt-6 w-full bg-white bg-opacity-20 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${overallPercentage > 90 ? 'bg-red-400' : overallPercentage > 75 ? 'bg-yellow-400' : 'bg-green-400'}`}
            style={{ width: `${Math.min(overallPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Alerts */}
      {overBudgetCategories.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900">Budget Alerts</h3>
              <p className="text-sm text-red-800 mt-1">
                You've exceeded your budget in {overBudgetCategories.length} {overBudgetCategories.length === 1 ? 'category' : 'categories'}:
              </p>
              <ul className="mt-2 space-y-1">
                {overBudgetCategories.map(cat => (
                  <li key={cat.id} className="text-sm text-red-800">
                    <span className="font-medium">{cat.name}</span> — Over by ${(cat.spent - cat.limit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Budget vs Spent Chart */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Budget Breakdown</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="name" stroke="#6B7280" angle={-45} textAnchor="end" height={100} />
            <YAxis stroke="#6B7280" />
            <Tooltip />
            <Legend />
            <Bar dataKey="Budget" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            <Bar dataKey="Spent" fill="#EF4444" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Category Details</h3>
        {categorySpending.map(category => (
          <div key={category.id} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{category.icon}</span>
                <div>
                  <h4 className="font-bold text-gray-900">{category.name}</h4>
                  <p className={`text-sm ${category.isOver ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                    {category.isOver && '⚠️ '} ${category.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })} of ${category.limit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${category.isOver ? 'text-red-600' : 'text-green-600'}`}>
                  {category.percentage.toFixed(0)}%
                </p>
                <p className="text-sm text-gray-600">
                  {category.isOver ? 'Over' : 'Remaining'}: ${Math.abs(category.remaining).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  category.percentage > 100 ? 'bg-red-600' : category.percentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(category.percentage, 100)}%` }}
              />
            </div>

            {category.isOver && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-700">
                  <span className="font-semibold">Over budget:</span> You've spent ${(category.spent - category.limit).toLocaleString('en-US', { minimumFractionDigits: 2 })} more than your budget
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
                Edit Budget
              </button>
              <button className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                View Transactions
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Spending by Category */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Spending Summary</h3>
        <div className="space-y-3">
          {categorySpending
            .sort((a, b) => b.spent - a.spent)
            .map(category => (
              <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{category.icon}</span>
                  <span className="font-medium text-gray-900">{category.name}</span>
                </div>
                <span className="font-bold text-gray-900">
                  ${category.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
