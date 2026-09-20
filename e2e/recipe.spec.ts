import { test, expect } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'e2e/.recipes')
const FILE = join(DIR, 'test-loaf.md')

test.beforeAll(() => {
  rmSync(DIR, { recursive: true, force: true })
  mkdirSync(DIR, { recursive: true })
})

test('create a recipe, then add a cook log entry', async ({ page }) => {
  // 1. Create a recipe in the editor and save it.
  await page.goto('/new')
  await page.getByLabel('Title').fill('Test Loaf')
  await page.getByLabel('Serves').fill('4')
  await page.getByLabel('Ingredient 1', { exact: true }).fill('500 g strong white flour')
  await page.getByLabel('Ingredient 2', { exact: true }).fill('a good pinch of sea salt')
  await page.getByLabel('Step 1', { exact: true }).fill('Mix and bake at 220C.')

  // The preview shows the exact file.
  await expect(page.locator('pre')).toContainText('- 500 g strong white flour')
  await expect(page.getByText('text only — will not scale')).toBeVisible()

  await page.getByRole('button', { name: 'Save recipe' }).click()
  await expect(page).toHaveURL(/\/r\/test-loaf$/)

  // 2. Read the new file from disk.
  expect(existsSync(FILE)).toBe(true)
  const created = readFileSync(FILE, 'utf8')
  expect(created).toContain('title: Test Loaf')
  expect(created).toContain('- a good pinch of sea salt')

  // The scale and unit controls work on the view only.
  await page.getByRole('button', { name: 'Imperial' }).click()
  await expect(
    page.getByRole('button', { name: '17.6 oz strong white flour' }),
  ).toBeVisible()
  await expect(page.getByText('425F')).toBeVisible()
  expect(readFileSync(FILE, 'utf8')).toBe(created)

  await page.getByRole('button', { name: 'Reset' }).click()

  // 3. Open the recipe and add a cook log entry.
  await page.getByRole('button', { name: 'I cooked this' }).click()
  await page.getByLabel('Date').fill('2026-09-20')
  await page.getByRole('button', { name: '4 stars' }).click()
  await page.getByLabel('Note').fill('Too salty. Next time 1 tsp.')
  await page.getByRole('button', { name: 'Save entry' }).click()

  // 4. The app adds the entry at the top of the cook log.
  await expect(page.getByText('Too salty. Next time 1 tsp.')).toBeVisible()
  const after = readFileSync(FILE, 'utf8')
  expect(after).toContain('## Cook Log\n\n### 2026-09-20 — ★★★★☆')

  // 5. The rest of the file has no change.
  const bodyBefore = created.slice(created.indexOf('# Test Loaf'))
  expect(after).toContain(bodyBefore.trimEnd())

  // 6. A second entry, then delete the newest one.
  await page.getByRole('button', { name: 'I cooked this' }).click()
  await page.getByLabel('Date').fill('2026-09-21')
  await page.getByLabel('Note').fill('Better with less salt.')
  await page.getByRole('button', { name: 'Save entry' }).click()
  await expect(page.getByText('Better with less salt.')).toBeVisible()

  await page.getByRole('button', { name: 'Delete the entry for 2026-09-21' }).click()
  await expect(page.getByText('Better with less salt.')).toHaveCount(0)

  // The older entry and the rest of the file survive the delete.
  await expect(page.getByText('Too salty. Next time 1 tsp.')).toBeVisible()
  const afterDelete = readFileSync(FILE, 'utf8')
  expect(afterDelete).not.toContain('2026-09-21')
  expect(afterDelete).toContain('### 2026-09-20 — ★★★★☆')
  expect(afterDelete).toContain(bodyBefore.trimEnd())
})

test('an edit made outside the app appears on the next load', async ({ page }) => {
  await page.goto('/r/test-loaf')
  await expect(page.getByRole('heading', { name: 'Test Loaf' })).toBeVisible()

  const text = readFileSync(FILE, 'utf8').replace('title: Test Loaf', 'title: Renamed Loaf')
  writeFileSync(FILE, text)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Renamed Loaf' })).toBeVisible()
})
