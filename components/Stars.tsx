export function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-ink-faint">—</span>
  return (
    <span className="text-accent" aria-label={`${rating} out of 5`}>
      {'★'.repeat(rating)}
      <span className="text-ink-dim">{'☆'.repeat(5 - rating)}</span>
    </span>
  )
}
