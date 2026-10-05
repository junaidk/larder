'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteRecipeAction } from '@/app/actions'
import type { RecipeRef } from '@/lib/recipe/types'

/**
 * Deletes a recipe from its own page. The first click asks, because this
 * control sits one click away from reading the recipe. The file moves to
 * `.trash`, so a wrong answer is not final.
 */
export function DeleteRecipe({ recipe }: { recipe: RecipeRef }) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    const result = await deleteRecipeAction(recipe)
    if (!result.ok) {
      setBusy(false)
      setError(result.error)
      return
    }
    router.push('/')
    router.refresh()
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-ink-muted hover:text-danger hover:underline"
      >
        Delete
      </button>
    )
  }

  return (
    <span className="flex items-center gap-3">
      {error && <span role="alert" className="text-danger">{error}</span>}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="text-danger hover:underline disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Really delete?'}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        disabled={busy}
        className="text-ink-muted hover:underline disabled:opacity-50"
      >
        Cancel
      </button>
    </span>
  )
}
