export interface ProteinViewStructure {
  url?: string
  connectedViewId?: string
  uniprotId?: string
  structureSequences?: string[]
  hoverGenomeHighlights?: { start: number; end: number }[]
}

export interface ProteinView {
  type: 'ProteinView'
  id: string
  displayName?: string
  structures: ProteinViewStructure[]
}

export function isProteinView(view: unknown): view is ProteinView {
  const v = view as Record<string, unknown>
  return v.type === 'ProteinView' && Array.isArray(v.structures)
}

/**
 * Extract all ProteinView instances from a session's views array.
 */
export function getProteinViews(views: { type: string }[]): ProteinView[] {
  return (views as unknown[]).filter(isProteinView)
}

/**
 * Helper to convert gapped MSA column to ungapped position for a specific row
 */
export function gappedToUngappedPosition(
  sequence: string,
  gappedPosition: number,
): number | undefined {
  if (gappedPosition < 0 || gappedPosition >= sequence.length) {
    return undefined
  }

  let ungapped = 0
  for (let i = 0; i < gappedPosition; i++) {
    if (sequence[i] !== '-') {
      ungapped++
    }
  }

  // If the position itself is a gap, return undefined
  if (sequence[gappedPosition] === '-') {
    return undefined
  }

  return ungapped
}
