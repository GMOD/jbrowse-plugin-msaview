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

/**
 * Convert Map to plain object for MST frozen storage
 */
export function mapToRecord(map: Map<number, number>): Record<number, number> {
  const record: Record<number, number> = {}
  for (const [key, value] of map) {
    record[key] = value
  }
  return record
}
