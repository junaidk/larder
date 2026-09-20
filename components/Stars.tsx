export function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-stone-400">—</span>
  return (
    <span className="text-amber-600" aria-label={`${rating} out of 5`}>
      {'★'.repeat(rating)}
      <span className="text-stone-300">{'☆'.repeat(5 - rating)}</span>
    </span>
  )
}
