export interface ProteinViewStructure {
  url?: string
  connectedViewId?: string
  uniprotId?: string
  structureSequences?: string[]
  hoverGenomeHighlights?: { start: number; end: number }[]
  hoverPosition?: { structureSeqPos?: number }
  clearHighlightFromExternal?: () => void
  highlightFromExternal?: (pos: number) => void
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
 * Represents a connection between the MSA view and a protein structure
 */
export interface StructureConnection {
  /** ID of the ProteinView containing the structure */
  proteinViewId: string
  /** Index of the structure within the ProteinView's structures array */
  structureIdx: number
  /** Name of the MSA row that corresponds to this structure */
  msaRowName: string
  /** Map from MSA ungapped position to structure sequence position */
  msaToStructure: Record<number, number>
  /** Map from structure sequence position to MSA ungapped position */
  structureToMsa: Record<number, number>
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

/**
 * Helper to convert ungapped position to gapped MSA column for a specific row
 */
export function ungappedToGappedPosition(
  sequence: string,
  ungappedPosition: number,
): number | undefined {
  let ungapped = 0
  for (let i = 0; i < sequence.length; i++) {
    const element = sequence[i]
    if (element !== '-') {
      if (ungapped === ungappedPosition) {
        return i
      }
      ungapped++
    }
  }
  return undefined
}
