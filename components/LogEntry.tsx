'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { updateLogEntryAction, type LogEntryInput } from '@/app/actions'
import { CookLogEntryForm } from '@/components/CookLogEntryForm'
import { DeleteLogEntry } from '@/components/DeleteLogEntry'
import { Stars } from '@/components/Stars'
import type { RecipeRef } from '@/lib/recipe/types'

/**
 * One cook log entry, with its edit and delete controls.
 *
 * `children` holds the note, rendered on the server as markdown. The entry
 * keeps that server markup until the user asks to edit.
 */
export function LogEntry({
  recipe, index, entry, children,
}: {
  recipe: RecipeRef
  index: number
  entry: LogEntryInput
  children: ReactNode
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <CookLogEntryForm
        initial={entry}
        label={`Edit the entry for ${entry.date}`}
        onSave={async (values) => {
          const result = await updateLogEntryAction(recipe, index, values)
          if (!result.ok) return result.error
          setEditing(false)
          router.refresh()
          return null
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 font-sans text-sm">
        <time className="font-medium text-ink-soft">{entry.date}</time>
        <Stars rating={entry.rating} />
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit the entry for ${entry.date}`}
            className="px-1 text-ink-faint hover:text-ink"
          >
            ✎
          </button>
          <DeleteLogEntry recipe={recipe} index={index} date={entry.date} />
        </span>
      </div>
      {children && <div className="mt-2">{children}</div>}
    </>
  )
}
