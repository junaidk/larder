import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'claims-')); process.env.RECIPES_DIR = dir })
afterEach(() => { rmSync(dir, { recursive: true, force: true }); delete process.env.RECIPES_DIR })
const R = '---\ntitle: X\n---\n\n# X\n\n## Ingredients\n\n- 1 egg\n'

// The README tells the reader which files the index leaves out. These tests
// hold that promise true.
describe('which files the index shows', () => {
  it('leaves out a file nested deeper than one folder', async () => {
    mkdirSync(join(dir, 'breads', 'old'), { recursive: true })
    writeFileSync(join(dir, 'breads', 'old', 'loaf.md'), R)
    writeFileSync(join(dir, 'breads', 'shown.md'), R)
    const { recipes } = await (await import('@/lib/storage/index')).listRecipes()
    expect(recipes.map((r) => r.slug)).toEqual(['shown'])
  })

  it('leaves out a file that is not markdown', async () => {
    mkdirSync(join(dir, 'breads'), { recursive: true })
    writeFileSync(join(dir, 'breads', 'photo.jpg'), 'binary')
    writeFileSync(join(dir, 'breads', 'shown.md'), R)
    const { recipes } = await (await import('@/lib/storage/index')).listRecipes()
    expect(recipes.map((r) => r.slug)).toEqual(['shown'])
  })

  it('leaves out a folder whose name breaks the rule, including a dot folder', async () => {
    mkdirSync(join(dir, '.obsidian'), { recursive: true })
    writeFileSync(join(dir, '.obsidian', 'a.md'), R)
    mkdirSync(join(dir, 'Main Courses'), { recursive: true })
    writeFileSync(join(dir, 'Main Courses', 'b.md'), R)
    mkdirSync(join(dir, 'breads'), { recursive: true })
    writeFileSync(join(dir, 'breads', 'shown.md'), R)
    const { recipes } = await (await import('@/lib/storage/index')).listRecipes()
    expect(recipes.map((r) => r.group)).toEqual(['breads'])
  })

  it('leaves out a file whose own name breaks the rule', async () => {
    mkdirSync(join(dir, 'breads'), { recursive: true })
    writeFileSync(join(dir, 'breads', 'Sourdough Loaf.md'), R)
    writeFileSync(join(dir, 'breads', 'shown.md'), R)
    const { recipes } = await (await import('@/lib/storage/index')).listRecipes()
    expect(recipes.map((r) => r.slug)).toEqual(['shown'])
  })
})
