# Supabase Setup Guide

## 🔧 Setup Steps

### Step 1: Create Database Tables

1. Go to your Supabase dashboard: https://app.supabase.com/
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the entire contents of `supabase-schema.sql` into the query editor
5. Click **Run** to execute

This will create:
- `users` - User profiles
- `accounts` - Bank/savings accounts
- `categories` - Expense/income categories
- `budgets` - Monthly budget limits
- `transactions` - All transactions
- `savings_goals` - Savings goals
- `transaction_suggestions` - For autocomplete

### Step 2: Set Up Authentication

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider (should be enabled by default)
3. Go to **Authentication** → **Email Templates**
4. Confirm the email verification template is set up

### Step 3: Install Dependencies

```bash
cd c:\Users\ashish.baboo\Desktop\Projects\IsaveMoneyClone
npm install
```

This will install `@supabase/supabase-js` and all other dependencies.

### Step 4: Verify Environment Variables

The `.env.local` file should already have:
```
VITE_SUPABASE_URL=https://uctmoxfalxyczrttyqto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ These are already configured.

### Step 5: Start the Development Server

```bash
npm run dev
```

The app should open at `http://localhost:5173`

## 🧪 Testing the Integration

### Test 1: Create an Account
1. Go to login page
2. Click "Sign Up" link
3. Enter email, password, and name
4. Click "Sign Up"
5. Confirm email (if email verification is enabled)
6. You should be redirected to dashboard

### Test 2: Create an Account (Bank Account)
1. Go to **Accounts** page
2. Click "Add Account" button
3. Fill in account details
4. Click "Add"
5. Verify it appears in the list and database

### Test 3: Add a Transaction
1. Go to **Transactions** page
2. Click "Add Transaction" button
3. Select expense/income type
4. Type a description (it will autocomplete with suggestions)
5. Select category
6. Enter amount
7. Click "Add Transaction"
8. Verify it appears in the list

### Test 4: Check Budget
1. Go to **Budget** page
2. See your monthly budgets and spending
3. The data should come from Supabase

## 📊 Database Structure

### Users Table
- `id` - UUID (linked to Supabase auth)
- `email` - Email address
- `full_name` - User's name
- `avatar_url` - Profile picture URL
- `created_at` - Account creation date

### Accounts Table
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `name` - Account name (e.g., "Checking Account")
- `type` - 'savings', 'checking', or 'credit'
- `balance` - Current balance
- `currency` - Currency code (e.g., 'USD')
- `icon` - Emoji icon

### Categories Table
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `name` - Category name (e.g., "Groceries")
- `type` - 'income' or 'expense'
- `icon` - Emoji icon
- `color` - Tailwind color class
- `budget_limit` - Monthly budget limit for this category

### Budgets Table
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `category_id` - Foreign key to categories
- `month` - Format: YYYY-MM (e.g., "2024-01")
- `limit_amount` - Budget limit for the month
- `spent` - Amount spent this month

### Transactions Table
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `account_id` - Foreign key to accounts
- `category_id` - Foreign key to categories
- `description` - Transaction description
- `amount` - Transaction amount
- `type` - 'income' or 'expense'
- `date` - Transaction date
- `icon` - Emoji icon

### Savings Goals Table
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `name` - Goal name (e.g., "Vacation")
- `target_amount` - Target amount to save
- `current_amount` - Current saved amount
- `deadline` - Target deadline date
- `icon` - Emoji icon
- `color` - Tailwind color class

## 🔐 Row Level Security (RLS)

All tables have RLS enabled. This means:
- Users can only see their own data
- Users can only insert/update their own data
- No user can access another user's data

Policies are already created in the SQL schema.

## 🚀 Production Deployment

### Before deploying to production:

1. **Disable Realtime** (optional, saves costs)
   - Go to Replication → disable if not needed

2. **Enable SMTP** for email verification
   - Go to Authentication → Email Templates
   - Set up custom SMTP if needed

3. **Set up backups**
   - Supabase handles this automatically

4. **Set up monitoring**
   - Use Supabase dashboard to monitor usage

5. **Environment variables in production**
   - Keep `.env.local` secrets safe
   - Use production Supabase keys for deployment
   - Never commit credentials to git

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Check `.env.local` file exists
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart dev server after changing `.env.local`

### "Failed to authenticate"
- Verify email/password in Supabase auth
- Check email verification is enabled
- Check RLS policies are correct

### "Transactions not showing up"
- Verify transaction is inserted in Supabase
- Check user_id matches current user
- Check date format is correct (YYYY-MM-DD)

### "Categories not loading"
- Check categories exist in Supabase
- Verify category user_id matches current user
- Check category type is 'income' or 'expense'

## 📚 Service Files

The app includes service files for all database operations:

- `src/services/authService.ts` - Authentication
- `src/services/accountService.ts` - Account CRUD
- `src/services/categoryService.ts` - Category CRUD
- `src/services/transactionService.ts` - Transaction CRUD + autocomplete
- `src/services/budgetService.ts` - Budget CRUD
- `src/services/goalService.ts` - Goal CRUD

All services use the Supabase client from `src/lib/supabase.ts`

## 🎯 Next Steps

1. ✅ Run the SQL schema in Supabase
2. ✅ Install dependencies (`npm install`)
3. ✅ Start dev server (`npm run dev`)
4. ✅ Test the features
5. Build pages to use database services (in progress)

## 📝 Notes

- Demo data is in `src/data.ts` - this is for reference only
- All real data comes from Supabase
- Authentication is handled by Supabase auth
- User ID is automatically tracked for all operations
- RLS policies ensure data isolation

---

**Supabase Connection Details:**
- URL: https://uctmoxfalxyczrttyqto.supabase.co
- Database: PostgreSQL
- Region: ap-southeast-2 (Australia)
- Tables: 7 (users, accounts, categories, budgets, transactions, savings_goals, transaction_suggestions)
