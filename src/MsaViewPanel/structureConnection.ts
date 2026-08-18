// Structurally typed against jbrowse-plugin-protein3d rather than imported from
// it: the two plugins ship independently, so a field the installed protein3d
// lacks reads as undefined instead of failing to resolve. Both highlight
// channels have been on its structure model since v0.4.0.
export interface ProteinViewStructure {
  url?: string
  connectedViewId?: string
  uniprotId?: string
  structureSequences?: string[]
  /** the residue under the pointer, transient */
  hoverGenomeHighlights?: { start: number; end: number }[]
  /** the clicked domain, persistent; also what `initialSelection` lights */
  clickGenomeHighlights?: { start: number; end: number }[]
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
