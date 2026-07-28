import { Plus, Edit2, Trash2, Calendar } from 'lucide-react'
import { mockGoals } from '../data'

export default function Goals() {
  const totalProgress = (
    mockGoals.reduce((sum, goal) => sum + goal.currentAmount, 0) /
    mockGoals.reduce((sum, goal) => sum + goal.targetAmount, 0)
  ) * 100

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Savings Goals</h1>
          <p className="text-gray-600 mt-1">Track and manage your financial goals</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New Goal</span>
        </button>
      </div>

      {/* Overall Progress */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 md:p-8 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-green-100 mb-2">Overall Progress</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              ${mockGoals.reduce((sum, g) => sum + g.currentAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h2>
            <p className="text-green-100 text-sm mt-1">
              of ${mockGoals.reduce((sum, g) => sum + g.targetAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} saved
            </p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-bold">{Math.round(totalProgress)}%</p>
            <p className="text-green-100">{mockGoals.filter(g => (g.currentAmount / g.targetAmount) === 1).length} Completed</p>
          </div>
        </div>
        <div className="w-full bg-white bg-opacity-20 rounded-full h-3">
          <div
            className="bg-white h-3 rounded-full transition-all"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mockGoals.map((goal) => {
          const progress = (goal.currentAmount / goal.targetAmount) * 100
          const remaining = goal.targetAmount - goal.currentAmount
          const deadline = new Date(goal.deadline)
          const daysLeft = Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

          return (
            <div key={goal.id} className="bg-white rounded-xl shadow hover:shadow-lg transition p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{goal.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{goal.name}</h3>
                    <p className="text-sm text-gray-600">
                      {daysLeft > 0 ? `${daysLeft} days left` : 'Deadline reached'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Progress</span>
                  <span className="text-lg font-bold text-gray-900">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`bg-gradient-to-r ${goal.color} h-3 rounded-full transition-all`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6 pt-6 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Saved</p>
                  <p className="font-semibold text-gray-900">
                    ${goal.currentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Goal</p>
                  <p className="font-semibold text-gray-900">
                    ${goal.targetAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Remaining</p>
                  <p className="font-semibold text-gray-900">
                    ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
                  Add Funds
                </button>
                <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm">
                  View Details
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Goal Suggestions */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Recommended Goals</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Emergency Fund', icon: '🚨', target: 10000 },
            { name: 'Wedding', icon: '💒', target: 25000 },
            { name: 'Business Investment', icon: '📈', target: 50000 }
          ].map((suggestion, idx) => (
            <div key={idx} className="p-4 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{suggestion.icon}</span>
                <p className="font-semibold text-gray-900">{suggestion.name}</p>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Target: ${suggestion.target.toLocaleString()}
              </p>
              <button className="w-full px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition font-medium text-sm">
                Create Goal
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
