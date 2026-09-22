import { test, expect } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'e2e/.recipes')
const FILE = join(DIR, 'breads', 'test-loaf.md')

test.beforeAll(() => {
  rmSync(DIR, { recursive: true, force: true })
  mkdirSync(DIR, { recursive: true })
})

test('create a recipe, then add a cook log entry', async ({ page }) => {
  // 1. Create a recipe in the editor and save it.
  await page.goto('/new')
  await page.getByLabel('Title').fill('Test Loaf')
  await page.getByLabel('Group').fill('breads')
  await page.getByLabel('Serves').fill('4')
  await page
    .getByLabel('Ingredients')
    .fill('500 g strong white flour\na good pinch of sea salt')
  await page.getByLabel('Method').fill('Mix and bake at 220C.')

  // The preview opens on the file, and shows the exact text.
  await expect(page.locator('pre')).toContainText('- 500 g strong white flour')

  // The readout names the line that will not scale, and only that line.
  await expect(page.getByText('2 ingredients · 1 scale and convert · 1 as written')).toBeVisible()
  await expect(page.getByText('Kept exactly as written')).toBeVisible()
  await expect(page.getByText('text only', { exact: true })).toBeVisible()

  // The other preview shows the recipe as it will read.
  await page.getByRole('button', { name: 'Recipe', exact: true }).click()
  // The textarea holds the same words, so look inside the preview only.
  await expect(
    page.locator('section').getByText('strong white flour').last(),
  ).toBeVisible()
  await page.getByRole('button', { name: 'File', exact: true }).click()

  await page.getByRole('button', { name: 'Save recipe' }).click()
  await expect(page).toHaveURL(/\/r\/breads\/test-loaf$/)

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
  // A bare date substring also matches the frontmatter's own created/updated
  // stamps whenever the suite runs on this same calendar date, so match the
  // cook log heading marker instead of the bare date.
  expect(afterDelete).not.toContain('### 2026-09-21')
  expect(afterDelete).toContain('### 2026-09-20 — ★★★★☆')
  expect(afterDelete).toContain(bodyBefore.trimEnd())
})

test('a saved imperial choice does not block a click on Metric', async ({ page }) => {
  // The saved choice used to come straight back, because metric was written
  // as "no units parameter", which the restore step read as "never chosen".
  await page.goto('/r/breads/test-loaf')
  await page.evaluate(() => localStorage.setItem('larder:units', 'imperial'))
  await page.goto('/r/breads/test-loaf')

  await expect(page.getByRole('button', { name: 'Imperial' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Metric' }).click()
  await expect(page.getByRole('button', { name: 'Metric' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/units=metric/)

  // And the amounts really do go back to the units in the file.
  await expect(page.getByRole('button', { name: '500 g strong white flour' })).toBeVisible()
})

test('an edit made outside the app appears on the next load', async ({ page }) => {
  await page.goto('/r/breads/test-loaf')
  await expect(page.getByRole('heading', { name: 'Test Loaf' })).toBeVisible()

  const text = readFileSync(FILE, 'utf8').replace('title: Test Loaf', 'title: Renamed Loaf')
  writeFileSync(FILE, text)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Renamed Loaf' })).toBeVisible()
})

test('changing the group moves the file and the URL', async ({ page }) => {
  const before = readFileSync(FILE, 'utf8')

  await page.goto('/r/breads/test-loaf/edit')
  await page.getByLabel('Group').fill('mains')
  await page.getByRole('button', { name: 'Save recipe' }).click()

  await expect(page).toHaveURL(/\/r\/mains\/test-loaf$/)

  const moved = join(DIR, 'mains', 'test-loaf.md')
  expect(existsSync(moved)).toBe(true)
  expect(existsSync(FILE)).toBe(false)

  // The move must not edit the content. Only the updated date may differ.
  const after = readFileSync(moved, 'utf8')
  const body = (t: string) => t.slice(t.indexOf('# Test Loaf'))
  expect(body(after)).toBe(body(before))
})

test('the theme opens dark, switches, and holds the choice', async ({ page }) => {
  const html = page.locator('html')

  // Nothing is stored on a first visit, so the app opens dark.
  await page.goto('/')
  await expect(html).toHaveAttribute('data-theme', 'dark')

  // The control names the theme it switches to.
  await page.getByRole('button', { name: 'Switch to the light theme' }).click()
  await expect(html).toHaveAttribute('data-theme', 'light')

  // The choice survives a reload. The page must never paint the other theme
  // first, so the attribute is already right on the very first frame.
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'light')

  // The choice carries to a recipe page, which holds its own copy of the
  // control among the view controls. An earlier test moved this recipe from
  // breads to mains, so that is where it now lives.
  await page.goto('/r/mains/test-loaf')
  await expect(html).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Switch to the dark theme' }).click()
  await expect(html).toHaveAttribute('data-theme', 'dark')

  await page.goto('/')
  await expect(html).toHaveAttribute('data-theme', 'dark')
})

test('a method section heading survives a round trip through the editor', async ({ page }) => {
  await page.goto('/new')
  await page.getByLabel('Title').fill('Sectioned')
  await page.getByLabel('Group').fill('breads')
  await page.getByLabel('Ingredients').fill('500 g flour')
  await page
    .getByLabel('Method')
    .fill('### Dough\n\nMix it.\nThen wait.\n\nRest it.\n\n### Bake\n\nHeat the oven.\n\nBake it.')

  // A step of two lines is one step, not two.
  await expect(page.getByText('4 steps · 2 sections')).toBeVisible()

  // The numbers start again at 1 below each heading, in the file itself.
  await expect(page.locator('pre')).toContainText(
    '### Dough\n\n1. Mix it.\nThen wait.\n2. Rest it.\n\n### Bake\n\n1. Heat the oven.\n2. Bake it.',
  )

  await page.getByRole('button', { name: 'Save recipe' }).click()
  await expect(page).toHaveURL(/\/r\/breads\/sectioned$/)

  // The recipe page shows both sections, each counting from 1.
  await expect(page.getByRole('heading', { name: 'Dough' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bake' })).toBeVisible()
  const numerals = await page.locator('ol li button span:first-child').allInnerTexts()
  expect(numerals).toEqual(['1', '2', '1', '2'])

  // Open the editor again: the headings come back as written, and saving
  // with no change leaves the file byte for byte the same.
  const file = join(DIR, 'breads', 'sectioned.md')
  const before = readFileSync(file, 'utf8')
  await page.goto('/r/breads/sectioned/edit')
  await expect(page.getByLabel('Method')).toHaveValue(
    '### Dough\n\nMix it.\nThen wait.\n\nRest it.\n\n### Bake\n\nHeat the oven.\n\nBake it.',
  )
  await page.getByRole('button', { name: 'Save recipe' }).click()
  await expect(page).toHaveURL(/\/r\/breads\/sectioned$/)

  const after = readFileSync(file, 'utf8')
  const body = (t: string) => t.slice(t.indexOf('# Sectioned'))
  expect(body(after)).toBe(body(before))
})
