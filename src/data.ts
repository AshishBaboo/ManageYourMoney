import { SavingsGoal, Account, Transaction, User, Category, Budget } from './types'

export const mockUser: User = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  avatar: '👤'
}

export const mockAccounts: Account[] = [
  {
    id: '1',
    name: 'Savings Account',
    type: 'savings',
    balance: 24500.50,
    currency: 'USD',
    icon: '🏦'
  },
  {
    id: '2',
    name: 'Checking Account',
    type: 'checking',
    balance: 5200.00,
    currency: 'USD',
    icon: '💳'
  },
  {
    id: '3',
    name: 'Emergency Fund',
    type: 'savings',
    balance: 15000.00,
    currency: 'USD',
    icon: '🚨'
  }
]

export const mockCategories: Category[] = [
  // Expense Categories
  { id: '1', name: 'Groceries', type: 'expense', icon: '🛒', color: 'from-green-500 to-green-600', budgetLimit: 600 },
  { id: '2', name: 'Dining', type: 'expense', icon: '🍽️', color: 'from-orange-500 to-orange-600', budgetLimit: 400 },
  { id: '3', name: 'Transportation', type: 'expense', icon: '🚗', color: 'from-blue-500 to-blue-600', budgetLimit: 300 },
  { id: '4', name: 'Utilities', type: 'expense', icon: '💡', color: 'from-yellow-500 to-yellow-600', budgetLimit: 250 },
  { id: '5', name: 'Entertainment', type: 'expense', icon: '🎬', color: 'from-purple-500 to-purple-600', budgetLimit: 200 },
  { id: '6', name: 'Shopping', type: 'expense', icon: '🛍️', color: 'from-pink-500 to-pink-600', budgetLimit: 300 },
  { id: '7', name: 'Fitness', type: 'expense', icon: '💪', color: 'from-red-500 to-red-600', budgetLimit: 100 },
  { id: '8', name: 'Healthcare', type: 'expense', icon: '🏥', color: 'from-indigo-500 to-indigo-600', budgetLimit: 200 },
  // Income Categories
  { id: '9', name: 'Salary', type: 'income', icon: '💼', color: 'from-green-500 to-green-600' },
  { id: '10', name: 'Freelance', type: 'income', icon: '💻', color: 'from-blue-500 to-blue-600' },
  { id: '11', name: 'Investments', type: 'income', icon: '📈', color: 'from-purple-500 to-purple-600' },
  { id: '12', name: 'Other Income', type: 'income', icon: '💰', color: 'from-yellow-500 to-yellow-600' }
]

export const mockBudgets: Budget[] = [
  { id: '1', categoryId: '1', month: '2024-01', limit: 600, spent: 425 },
  { id: '2', categoryId: '2', month: '2024-01', limit: 400, spent: 285 },
  { id: '3', categoryId: '3', month: '2024-01', limit: 300, spent: 155 },
  { id: '4', categoryId: '4', month: '2024-01', limit: 250, spent: 180 },
  { id: '5', categoryId: '5', month: '2024-01', limit: 200, spent: 95 },
  { id: '6', categoryId: '6', month: '2024-01', limit: 300, spent: 220 },
  { id: '7', categoryId: '7', month: '2024-01', limit: 100, spent: 0 },
  { id: '8', categoryId: '8', month: '2024-01', limit: 200, spent: 50 }
]

export const mockGoals: SavingsGoal[] = [
  {
    id: '1',
    name: 'Vacation',
    targetAmount: 5000,
    currentAmount: 3200,
    deadline: '2024-12-31',
    icon: '✈️',
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: '2',
    name: 'New Car',
    targetAmount: 35000,
    currentAmount: 18500,
    deadline: '2025-06-30',
    icon: '🚗',
    color: 'from-orange-500 to-orange-600'
  },
  {
    id: '3',
    name: 'Home Down Payment',
    targetAmount: 100000,
    currentAmount: 45000,
    deadline: '2026-12-31',
    icon: '🏠',
    color: 'from-green-500 to-green-600'
  },
  {
    id: '4',
    name: 'Education',
    targetAmount: 20000,
    currentAmount: 12000,
    deadline: '2025-08-31',
    icon: '📚',
    color: 'from-purple-500 to-purple-600'
  }
]

export const mockTransactions: Transaction[] = [
  {
    id: '1',
    accountId: '1',
    description: 'Monthly Salary',
    amount: 5000,
    type: 'income',
    category: 'Salary',
    date: '2024-01-15',
    icon: '💼'
  },
  {
    id: '2',
    accountId: '1',
    description: 'Whole Foods Market',
    amount: -125.50,
    type: 'expense',
    category: 'Groceries',
    date: '2024-01-14',
    icon: '🛒'
  },
  {
    id: '3',
    accountId: '2',
    description: 'Shell Gas Station',
    amount: -55.00,
    type: 'expense',
    category: 'Transportation',
    date: '2024-01-14',
    icon: '⛽'
  },
  {
    id: '4',
    accountId: '1',
    description: 'Electric Bill',
    amount: -180.00,
    type: 'expense',
    category: 'Utilities',
    date: '2024-01-13',
    icon: '💡'
  },
  {
    id: '5',
    accountId: '1',
    description: 'Olive Garden Restaurant',
    amount: -65.00,
    type: 'expense',
    category: 'Dining',
    date: '2024-01-13',
    icon: '🍽️'
  },
  {
    id: '6',
    accountId: '1',
    description: 'Freelance Project Payment',
    amount: 800,
    type: 'income',
    category: 'Freelance',
    date: '2024-01-12',
    icon: '💻'
  },
  {
    id: '7',
    accountId: '1',
    description: 'Costco Shopping',
    amount: -220.00,
    type: 'expense',
    category: 'Shopping',
    date: '2024-01-11',
    icon: '🛍️'
  },
  {
    id: '8',
    accountId: '1',
    description: 'Trader Joe',
    amount: -89.50,
    type: 'expense',
    category: 'Groceries',
    date: '2024-01-10',
    icon: '🛒'
  },
  {
    id: '9',
    accountId: '1',
    description: 'Starbucks Coffee',
    amount: -35.00,
    type: 'expense',
    category: 'Dining',
    date: '2024-01-09',
    icon: '☕'
  },
  {
    id: '10',
    accountId: '1',
    description: 'Netflix Subscription',
    amount: -15.99,
    type: 'expense',
    category: 'Entertainment',
    date: '2024-01-08',
    icon: '🎬'
  },
  {
    id: '11',
    accountId: '1',
    description: 'CVS Pharmacy',
    amount: -50.00,
    type: 'expense',
    category: 'Healthcare',
    date: '2024-01-07',
    icon: '🏥'
  },
  {
    id: '12',
    accountId: '1',
    description: 'Amazon Purchase',
    amount: -110.00,
    type: 'expense',
    category: 'Shopping',
    date: '2024-01-06',
    icon: '🛍️'
  }
]

export const transactionSuggestions = [
  'Whole Foods Market',
  'Trader Joe',
  'Starbucks Coffee',
  'Olive Garden Restaurant',
  'Shell Gas Station',
  'Amazon Purchase',
  'Costco Shopping',
  'Netflix Subscription',
  'CVS Pharmacy',
  'Electric Bill'
]
