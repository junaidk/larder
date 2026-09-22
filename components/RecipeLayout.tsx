'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { ViewControls } from '@/components/ViewControls'

const COLUMNS_KEY = 'larder:columns'

export type Columns = 'one' | 'two'

/**
 * Holds the controls and the body of the recipe.
 * The page itself renders on the server, so this small client shell owns the
 * one piece of state the page needs: how many columns to use.
 */
export function RecipeLayout({
  ingredients,
  body,
}: {
  ingredients: ReactNode
  body: ReactNode
}) {
  const [columns, setColumns] = useState<Columns>('two')

  useEffect(() => {
    try {
      if (localStorage.getItem(COLUMNS_KEY) === 'one') setColumns('one')
    } catch { /* storage is not available */ }
  }, [])

  function choose(next: Columns) {
    setColumns(next)
    try { localStorage.setItem(COLUMNS_KEY, next) } catch { /* storage is not available */ }
  }

  return (
    <>
      <div className="no-print my-8 border-y border-line py-4">
        <Suspense fallback={null}>
          <ViewControls columns={columns} onColumns={choose} />
        </Suspense>
      </div>

      <div
        data-columns={columns}
        className={
          columns === 'two'
            ? 'print-single-column grid gap-10 lg:grid-cols-[19rem_1fr] lg:gap-14'
            : 'flex flex-col gap-10'
        }
      >
        {ingredients}
        {body}
      </div>
    </>
  )
}
