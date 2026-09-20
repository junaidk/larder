import type {
  CookLogEntry, Ingredient, IngredientGroup, Recipe,
} from '@/lib/recipe/types'

export function ingredientGroups(recipe: Recipe): IngredientGroup[] {
  const block = recipe.blocks.find((b) => b.kind === 'ingredients')
  if (!block || block.kind !== 'ingredients') return []

  const groups: IngredientGroup[] = [{ name: null, ingredients: [] }]
  for (const line of block.lines) {
    if (line.type === 'group') groups.push({ name: line.name, ingredients: [] })
    else if (line.type === 'ingredient') groups[groups.length - 1].ingredients.push(line.ingredient)
  }
  // Drop the leading group when the file starts with a `###` heading.
  return groups.filter((g, i) => i > 0 || g.ingredients.length > 0)
}

export function allIngredients(recipe: Recipe): Ingredient[] {
  return ingredientGroups(recipe).flatMap((g) => g.ingredients)
}

export function methodText(recipe: Recipe): string {
  const block = recipe.blocks.find((b) => b.kind === 'method')
  return block && block.kind === 'method' ? block.lines.join('\n').trim() : ''
}

export function notesText(recipe: Recipe): string | null {
  const block = recipe.blocks.find((b) => b.kind === 'notes')
  return block && block.kind === 'notes' ? block.lines.join('\n').trim() : null
}

export function cookLog(recipe: Recipe): CookLogEntry[] {
  const block = recipe.blocks.find((b) => b.kind === 'cooklog')
  return block && block.kind === 'cooklog' ? block.entries : []
}
