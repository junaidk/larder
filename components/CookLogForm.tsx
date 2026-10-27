'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { addLogEntryAction } from '@/app/actions'
import { CookLogEntryForm } from '@/components/CookLogEntryForm'
import type { RecipeRef } from '@/lib/recipe/types'

export function CookLogForm({ recipe }: { recipe: RecipeRef }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-medium">Cook log</h2>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded bg-invert-surface px-3 py-1.5 text-sm text-invert-ink hover:bg-invert-surface-hover"
        >
          I cooked this
        </button>
      )}
    </div>
  )

  if (!open) return header

  return (
    <>
      {header}
      <CookLogEntryForm
        label="Add a cook log entry"
        onSave={async (values) => {
          const result = await addLogEntryAction(recipe, values)
          if (!result.ok) return result.error
          setOpen(false)
          router.refresh()
          return null
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
