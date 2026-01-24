import { gappedToUngappedPosition } from './structureConnection'

import type { MafRegion } from './types'

export function msaCoordToGenomeCoord({
  model,
  coord: mouseCol,
}: {
  model: {
    querySeqName: string
    transcriptToMsaMap:
      | {
          refName: string
          p2g: Record<number, number>
        }
      | undefined
    mafRegion?: MafRegion
    rows: string[][]
  }
  coord: number
}) {
  const { querySeqName, transcriptToMsaMap, mafRegion } = model

  // Get the query sequence
  const queryRow = model.rows.find(f => f[0] === querySeqName)
  const querySeq = queryRow?.[1]
  if (!querySeq) {
    return undefined
  }

  // Convert gapped MSA column to ungapped sequence coordinate
  // Returns undefined if the position is a gap
  const ungappedPos = gappedToUngappedPosition(querySeq, mouseCol)
  if (ungappedPos === undefined) {
    return undefined
  }

  // Handle MAF region mapping
  if (mafRegion) {
    const genomePos = mafRegion.start + ungappedPos
    // Check if position is within the region
    if (genomePos >= mafRegion.end) {
      return undefined
    }
    return {
      refName: mafRegion.refName,
      start: genomePos,
      end: genomePos + 1,
    }
  }

  // Handle transcript mapping (original behavior)
  if (transcriptToMsaMap) {
    const { refName, p2g } = transcriptToMsaMap
    const s = p2g[ungappedPos]
    const e = p2g[ungappedPos + 1]
    return s !== undefined && e !== undefined
      ? {
          refName,
          start: Math.min(s, e),
          end: Math.max(s, e),
        }
      : undefined
  }

  return undefined
}
