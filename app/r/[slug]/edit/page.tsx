import { notFound } from 'next/navigation'
import { RecipeEditor } from '@/components/RecipeEditor'
import { readRecipe } from '@/lib/storage/index'
import { stateFromRecipe } from '@/lib/view/build'

export const dynamic = 'force-dynamic'

export default async function EditRecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const recipe = await readRecipe(slug)
  if (!recipe) notFound()

  return (
    <main>
      <RecipeEditor
        initial={stateFromRecipe(recipe)}
        existing={recipe}
        slug={slug}
        today={new Date().toISOString().slice(0, 10)}
      />
    </main>
  )
}
