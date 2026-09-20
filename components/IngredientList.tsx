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
            <h3 className="mb-2 font-sans text-xs font-medium tracking-wide text-stone-500 uppercase">
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
                    className={`flex w-full gap-2 rounded px-1 py-1 text-left hover:bg-stone-100 ${
                      struck ? 'opacity-40' : ''
                    }`}
                  >
                    {p.text ? (
                      // A line the parser could not read has no amount, so it
                      // uses the whole width instead of an empty column.
                      <span
                        className={`font-serif text-stone-800 ${struck ? 'line-through' : ''}`}
                      >
                        {p.text}
                      </span>
                    ) : (
                      <>
                        <span
                          className={`w-14 shrink-0 font-sans text-sm font-medium tabular-nums text-stone-900 ${
                            struck ? 'line-through' : ''
                          }`}
                        >
                          {p.amount}
                        </span>
                        <span
                          className={`w-12 shrink-0 font-sans text-sm text-stone-400 ${
                            struck ? 'line-through' : ''
                          }`}
                        >
                          {p.unit}
                        </span>
                        <span
                          className={`min-w-0 font-serif text-stone-800 ${struck ? 'line-through' : ''}`}
                        >
                          {p.item}
                          {p.prep && <span className="text-stone-500 italic">, {p.prep}</span>}
                        </span>
                      </>
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
