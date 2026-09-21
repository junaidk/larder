/**
 * Decide whether a group shows its recipes.
 *
 * A filter overrides the collapsed set. A collapsed group would otherwise
 * hide its own search hits, which reads as though the search found nothing.
 * The set itself is untouched, so clearing the filter restores the choice.
 */
export function isGroupOpen(group: string, collapsed: string[], filtering: boolean): boolean {
  if (filtering) return true
  return !collapsed.includes(group)
}

/**
 * The one control reads as the action it will take.
 *
 * A filter opens every group, so while one is active the control must offer
 * to collapse. Reading "Expand all" beside groups that are plainly open
 * contradicts what the reader sees.
 */
export function collapseAllLabel(
  groups: string[],
  collapsed: string[],
  filtering: boolean,
): string {
  if (filtering) return 'Collapse all'
  const allClosed = groups.length > 0 && groups.every((g) => collapsed.includes(g))
  return allClosed ? 'Expand all' : 'Collapse all'
}

/** Add or remove one group, without changing the array that came in. */
export function toggled(collapsed: string[], group: string): string[] {
  return collapsed.includes(group)
    ? collapsed.filter((g) => g !== group)
    : [...collapsed, group]
}
