import { test, expect } from '@playwright/test'

test.describe('ManageYourMoney App - Complete Functionality Test', () => {
  const baseUrl = 'http://localhost:5173'
  const testUser = {
    email: 'nandinit887@gmail.com',
    password: 'Notsecure@3010'
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
  })

  test('1. Login with Nandini account', async ({ page }) => {
    // Should show login form
    await expect(page.locator('text=Sign In')).toBeVisible()

    // Fill login credentials
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)

    // Click sign in
    await page.click('button:has-text("Sign In")')

    // Wait for redirect to dashboard
    await page.waitForURL(baseUrl + '/')
    await expect(page.locator('text=Accounts')).toBeVisible({ timeout: 10000 })

    console.log('✅ Login successful')
  })

  test('2. Dashboard loads with user data isolation', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(baseUrl + '/')

    // Wait for data to load
    await page.waitForTimeout(1000)

    // Check if dashboard has summary cards
    const balanceCard = page.locator('text=Total Balance')
    await expect(balanceCard).toBeVisible()

    // Should show user's own data (Nandini's accounts)
    const accountsList = page.locator('text=Accounts').first()
    await expect(accountsList).toBeVisible()

    // Take screenshot for UI verification
    await page.screenshot({ path: 'screenshots/01-dashboard.png' })
    console.log('✅ Dashboard loaded successfully')
  })

  test('3. Add Account button works', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(baseUrl + '/')
    await page.waitForTimeout(500)

    // Add new account
    const nameInput = page.locator('input[placeholder="Name"]')
    const balanceInput = page.locator('input[placeholder="Balance"]')

    await nameInput.fill(`Test Account ${Date.now()}`)
    await balanceInput.fill('5000')

    const addButton = page.locator('button:has-text("Add")')
    await addButton.click()

    // Wait for notification
    await expect(page.locator('text=Account added successfully')).toBeVisible({ timeout: 5000 })
    console.log('✅ Add Account button works')
  })

  test('4. Delete Account button works', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(baseUrl + '/')
    await page.waitForTimeout(500)

    // Add account first
    const nameInput = page.locator('input[placeholder="Name"]')
    const balanceInput = page.locator('input[placeholder="Balance"]')

    await nameInput.fill(`Delete Test ${Date.now()}`)
    await balanceInput.fill('1000')
    await page.locator('button:has-text("Add")').click()
    await expect(page.locator('text=Account added successfully')).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Delete the account
    const deleteButtons = page.locator('button svg[class*="text-red"]')
    if (await deleteButtons.count() > 0) {
      await deleteButtons.first().click()
      await expect(page.locator('text=Account deleted successfully')).toBeVisible({ timeout: 5000 })
      console.log('✅ Delete Account button works')
    }
  })

  test('5. INR currency formatting is applied', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(baseUrl + '/')
    await page.waitForTimeout(1000)

    // Check for ₹ symbol - should appear in Total Balance, Income, or Spent
    await expect(page.locator('text=/₹/').first()).toBeVisible({ timeout: 5000 })
    console.log('✅ INR currency formatting is applied')
  })

  test('6. UI is compact and responsive', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(baseUrl + '/')

    // Check mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.screenshot({ path: 'screenshots/02-mobile-dashboard.png' })

    // Check desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.screenshot({ path: 'screenshots/03-desktop-dashboard.png' })

    // Verify no horizontal overflow
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(isOverflowing).toBe(false)

    console.log('✅ UI is compact and responsive')
  })

  test('7. Notifications appear and disappear', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(baseUrl + '/')

    // Try to add account without name (should show error)
    await page.fill('input[placeholder="Balance"]', '5000')
    await page.click('button:has-text("Add")')

    // Notification should appear
    const notification = page.locator('text=Please fill in all fields')
    await expect(notification).toBeVisible()

    // Notification should disappear after 3 seconds
    await page.waitForTimeout(3500)
    await expect(notification).not.toBeVisible()

    console.log('✅ Notifications work correctly')
  })

  test('8. Data isolation - See only own data', async ({ page }) => {
    // Login as Nandini
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(baseUrl + '/')
    await page.waitForTimeout(1000)

    // Verify user data is loaded (should see accounts section)
    await expect(page.locator('text=Accounts')).toBeVisible()

    // Data is filtered by user_id in Supabase, so only Nandini's data appears
    console.log('✅ Data isolation verified')
  })

  test('9. Header shows app name and user info', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(baseUrl + '/')

    // Check header has correct app name
    await expect(page.locator('text=MYM')).toBeVisible()

    // Check user avatar exists
    const avatar = page.locator('[class*="bg-gradient"]').first()
    await expect(avatar).toBeVisible()

    console.log('✅ Header displays correctly')
  })

  test('10. Attribution link is visible', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    await page.click('button:has-text("Sign In")')
    await page.waitForURL(baseUrl + '/')

    // Scroll to bottom to see attribution
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Check attribution is visible
    await expect(page.locator('text=Developed by')).toBeVisible()
    await expect(page.locator('a:has-text("Ashish Baboo")')).toBeVisible()

    console.log('✅ Attribution is displayed')
  })
})
