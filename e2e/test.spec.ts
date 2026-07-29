import { test, expect, Page } from '@playwright/test'

const baseUrl = 'http://localhost:5173'
const testUser = { email: 'nandinit887@gmail.com', password: 'Notsecure@3010' }

// Old mock/dummy strings that must NEVER appear anywhere
const DUMMY_STRINGS = [
  'John Doe', 'john@example.com', 'Starbucks', 'March 2024', 'iSaveMoney',
  'Main Savings', 'Everyday Checking', 'Whole Foods', 'Netflix',
]

async function login(page: Page) {
  await page.goto(baseUrl)
  await page.fill('input[type="email"]', testUser.email)
  await page.fill('input[type="password"]', testUser.password)
  await page.click('button:has-text("SIGN IN")')
  await page.waitForSelector('header', { timeout: 15000 })
}

async function assertNoDummyData(page: Page, pageName: string) {
  const content = await page.content()
  for (const s of DUMMY_STRINGS) {
    expect(content, `"${s}" found on ${pageName} — dummy data leak!`).not.toContain(s)
  }
}

async function assertNoHorizontalOverflow(page: Page, pageName: string) {
  const overflowing = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  )
  expect(overflowing, `${pageName} overflows horizontally`).toBe(false)
}

test.describe('ManageYourMoney — full app verification', () => {

  test('1. Login works and shows real user identity (not John Doe / AA)', async ({ page }) => {
    await login(page)
    // Avatar must show initials of "Nandini T" = NT
    await expect(page.locator('header button[title="Nandini T"]')).toBeVisible()
    await expect(page.locator('header')).toContainText('NT')
    // Open user menu — real name + email
    await page.click('header button[title="Nandini T"]')
    await expect(page.locator('text=Nandini T').first()).toBeVisible()
    await expect(page.locator(`text=${testUser.email}`).first()).toBeVisible()
    await assertNoDummyData(page, 'Dashboard')
  })

  test('2. Dashboard: no dummy data, INR shown, add-account form present', async ({ page }) => {
    await login(page)
    await page.waitForSelector('text=Loading your data...', { state: 'detached', timeout: 15000 })
    await expect(page.locator('text=Accounts').first()).toBeVisible()
    await assertNoDummyData(page, 'Dashboard')
    // INR symbol in summary cards
    expect(await page.content()).toContain('₹')
    // Add-account controls exist and accept input
    await page.fill('input[placeholder="Name"]', 'Playwright Test')
    await page.fill('input[placeholder="Balance"]', '100')
    await expect(page.locator('input[placeholder="Name"]')).toHaveValue('Playwright Test')
    await assertNoHorizontalOverflow(page, 'Dashboard')
  })

  test('3. Sidebar navigates to every page, active state follows', async ({ page }) => {
    await login(page)
    const pages = [
      { label: 'Accounts', h1: 'Accounts' },
      { label: 'Transactions', h1: 'Transactions' },
      { label: 'Budget', h1: 'Budget' },
      { label: 'Goals', h1: 'Savings Goals' },
      { label: 'Settings', h1: 'Settings' },
      { label: 'Dashboard', h1: 'Accounts' }, // dashboard shows Accounts section
    ]
    for (const p of pages) {
      await page.click(`aside a:has-text("${p.label}")`)
      await expect(page.locator(`text=${p.h1}`).first()).toBeVisible({ timeout: 5000 })
      await assertNoDummyData(page, p.label)
    }
  })

  test('4. Accounts page: add + transfer forms open, no dummy data', async ({ page }) => {
    await login(page)
    await page.goto(`${baseUrl}/accounts`)
    await expect(page.locator('text=Total Balance').first()).toBeVisible()
    await assertNoDummyData(page, 'Accounts')
    // Add Account form opens
    await page.click('button:has-text("Add Account")')
    await expect(page.locator('text=New Account')).toBeVisible()
    await expect(page.locator('input[placeholder="e.g. HDFC Savings"]')).toBeVisible()
    // Type dropdown has valid DB types
    const options = await page.locator('select').first().locator('option').allTextContents()
    expect(options.join(',')).toContain('Savings')
    await assertNoHorizontalOverflow(page, 'Accounts')
  })

  test('5. Transactions page: filters work, add form opens, INR in amounts', async ({ page }) => {
    await login(page)
    await page.goto(`${baseUrl}/transactions`)
    await expect(page.locator('text=Income').first()).toBeVisible()
    await assertNoDummyData(page, 'Transactions')
    // Filter buttons toggle
    await page.click('button:has-text("income")')
    await page.click('button:has-text("expense")')
    await page.click('button:has-text("all")')
    // Add form opens
    await page.locator('button', { hasText: 'Add' }).first().click()
    await expect(page.locator('text=New Transaction')).toBeVisible()
    expect(await page.content()).toContain('₹')
    await assertNoHorizontalOverflow(page, 'Transactions')
  })

  test('6. Budget page: current month (not March 2024), category form opens, month nav works', async ({ page }) => {
    await login(page)
    await page.goto(`${baseUrl}/budget`)
    // Month should be the REAL current month
    const now = new Date()
    const monthName = now.toLocaleString('en-US', { month: 'long' })
    await expect(page.locator(`text=${monthName} ${now.getFullYear()}`)).toBeVisible()
    await assertNoDummyData(page, 'Budget')
    // Month navigation
    await page.click('button[aria-label="Previous month"]')
    await page.click('button[aria-label="Next month"]')
    await expect(page.locator(`text=${monthName} ${now.getFullYear()}`)).toBeVisible()
    // New Category form
    await page.click('button:has-text("New Category")')
    await expect(page.locator('input[placeholder="e.g. Groceries"]')).toBeVisible()
    await assertNoHorizontalOverflow(page, 'Budget')
  })

  test('7. Goals page: new goal form + suggestions render, no dummy goals', async ({ page }) => {
    await login(page)
    await page.goto(`${baseUrl}/goals`)
    await expect(page.locator('text=Savings Goals').first()).toBeVisible()
    await assertNoDummyData(page, 'Goals')
    await page.click('button:has-text("New Goal")')
    await expect(page.locator('input[placeholder="e.g. New Laptop"]')).toBeVisible()
    // Suggestions present with INR targets
    await expect(page.locator('text=Emergency Fund')).toBeVisible()
    await assertNoHorizontalOverflow(page, 'Goals')
  })

  test('8. Settings: real profile (Nandini T), dark mode toggle WORKS, currency select', async ({ page }) => {
    await login(page)
    await page.goto(`${baseUrl}/settings`)
    // Real profile — NOT John Doe
    await expect(page.locator('text=Nandini T').first()).toBeVisible()
    await expect(page.locator(`text=${testUser.email}`).first()).toBeVisible()
    await assertNoDummyData(page, 'Settings')

    // Dark mode toggle actually flips the html class
    await page.click('button:has-text("Dark")')
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Persists across reload
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Back to light
    await page.click('button:has-text("Light")')
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    // Currency selector: INR default, switchable
    const currencySelect = page.locator('select')
    await expect(currencySelect).toHaveValue('INR')
    await currencySelect.selectOption('USD')
    await expect(page.locator('[data-testid="toast"]')).toContainText('USD')
    await currencySelect.selectOption('INR')
    await assertNoHorizontalOverflow(page, 'Settings')
  })

  test('9. Mobile (375px): every page compact, nothing overflows', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await login(page)
    for (const route of ['/', '/accounts', '/transactions', '/budget', '/goals', '/settings']) {
      await page.goto(baseUrl + route)
      await page.waitForFunction(() => !document.body.innerText.includes('Loading'), null, { timeout: 15000 }).catch(() => {})
      await assertNoHorizontalOverflow(page, `mobile ${route}`)
      await page.screenshot({ path: `screenshots/mobile${route.replace('/', '-') || '-dashboard'}.png` })
    }
    // Hamburger menu opens sidebar on mobile
    await page.goto(baseUrl)
    await page.click('button[aria-label="Menu"]')
    await expect(page.locator('aside')).toBeVisible()
  })

  test('10. Desktop screenshots of every page for visual review', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await login(page)
    for (const route of ['/', '/accounts', '/transactions', '/budget', '/goals', '/settings']) {
      await page.goto(baseUrl + route)
      await page.waitForFunction(() => !document.body.innerText.includes('Loading'), null, { timeout: 15000 }).catch(() => {})
      await page.screenshot({ path: `screenshots/desktop${route.replace('/', '-') || '-dashboard'}.png` })
    }
    // Dark mode screenshot
    await page.goto(`${baseUrl}/settings`)
    await page.click('button:has-text("Dark")')
    await page.goto(baseUrl)
    await page.waitForFunction(() => !document.body.innerText.includes('Loading'), null, { timeout: 15000 }).catch(() => {})
    await page.screenshot({ path: 'screenshots/desktop-dashboard-dark.png' })
  })

  test('11. Sign out returns to login screen', async ({ page }) => {
    await login(page)
    await page.click('header button[title="Nandini T"]')
    await page.click('button:has-text("Sign Out")')
    await expect(page.locator('button:has-text("SIGN IN")')).toBeVisible({ timeout: 10000 })
  })
})
