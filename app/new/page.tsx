import { RecipeEditor } from '@/components/RecipeEditor'
import { emptyState } from '@/lib/view/build'

export const dynamic = 'force-dynamic'

export default function NewRecipePage() {
  return (
    <main>
      <RecipeEditor
        initial={emptyState()}
        existing={null}
        slug={null}
        today={new Date().toISOString().slice(0, 10)}
      />
    </main>
  )
}
