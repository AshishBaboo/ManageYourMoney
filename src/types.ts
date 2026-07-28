export interface SavingsGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string
  icon: string
  color: string
}

export interface Account {
  id: string
  name: string
  type: string
  balance: number
  currency: string
  icon: string
}

export interface Transaction {
  id: string
  accountId: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  date: string
  icon: string
}

export interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string
  color: string
  budgetLimit?: number
}

export interface Budget {
  id: string
  categoryId: string
  month: string
  limit: number
  spent: number
}

export interface CategoryBudget {
  category: Category
  budget?: Budget
  spent: number
  limit: number
  percentage: number
}

export interface User {
  id: string
  name: string
  email: string
  avatar: string
}
