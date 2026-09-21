import { RecipeEditor } from '@/components/RecipeEditor'
import { listGroups } from '@/lib/storage/index'
import { emptyState } from '@/lib/view/build'

export const dynamic = 'force-dynamic'

export default async function NewRecipePage() {
  return (
    <main>
      <RecipeEditor
        initial={emptyState()}
        existing={null}
        recipe={null}
        groups={await listGroups()}
        today={new Date().toISOString().slice(0, 10)}
      />
    </main>
  )
}
