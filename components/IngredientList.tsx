'use client'

import { useState } from 'react'
import type { IngredientParts } from '@/lib/view/display'

/** The parts, plus the whole line. Screen readers read the whole line. */
export type DisplayIngredient = IngredientParts & { line: string }

export interface DisplayGroup {
  name: string | null
  ingredients: DisplayIngredient[]
}

/**
 * The ingredient list. A click strikes a line through, to help you keep
 * your place while you cook. The mark lives in this page only. It never
 * reaches the recipe file and it clears on a reload.
 */
export function IngredientList({ groups }: { groups: DisplayGroup[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({})

  function toggle(key: string) {
    setDone((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  return (
    <div className="space-y-5">
      {groups.map((group, g) => (
        <div key={g}>
          {group.name && (
            <h3 className="mb-2 pl-12 font-sans text-xs font-medium tracking-wide text-ink-muted uppercase">
              {group.name}
            </h3>
          )}
          <ul className="space-y-1">
            {group.ingredients.map((p, i) => {
              const key = `${g}-${i}`
              const struck = done[key]
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-pressed={struck}
                    aria-label={p.line}
                    className={`flex w-full gap-4 rounded px-1 py-1 text-left hover:bg-raised ${
                      struck ? 'opacity-40' : ''
                    }`}
                  >
                    {/* Same width and alignment as a step numeral, so the dot
                        sits where a number sits in the method. */}
                    <span aria-hidden className="flex w-8 shrink-0 justify-end pt-[0.45rem]">
                      <span className="h-2 w-2 rounded-full bg-ink-dim" />
                    </span>
                    {p.text ? (
                      // A line the parser could not read has no amount, so it
                      // uses the whole width instead of an empty column.
                      <span
                        className={`font-serif text-ink ${struck ? 'line-through' : ''}`}
                      >
                        {p.text}
                      </span>
                    ) : (
                      <span
                        className={`min-w-0 font-serif text-ink ${struck ? 'line-through' : ''}`}
                      >
                        <span className="font-sans text-sm font-medium tabular-nums text-ink">
                          {p.amount}
                        </span>
                        {p.unit && <span className="font-sans text-sm text-accent-text"> {p.unit}</span>}
                        {' '}
                        {p.item}
                        {p.prep && <span className="text-ink-muted italic">, {p.prep}</span>}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
