import { notFound } from 'next/navigation'
import { RecipeEditor } from '@/components/RecipeEditor'
import { listGroups, readRecipe } from '@/lib/storage/index'
import { stateFromRecipe } from '@/lib/view/build'

export const dynamic = 'force-dynamic'

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ group: string; slug: string }>
}) {
  const { group, slug } = await params
  const recipe = await readRecipe({ group, slug })
  if (!recipe) notFound()

  return (
    <main>
      <RecipeEditor
        initial={stateFromRecipe(recipe)}
        existing={recipe}
        recipe={{ group, slug }}
        groups={await listGroups()}
        today={new Date().toISOString().slice(0, 10)}
      />
    </main>
  )
}
