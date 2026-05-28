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

  const querySeq = model.rows.find(f => f[0] === querySeqName)?.[1]
  if (!querySeq) {
    return undefined
  }

  const ungappedPos = gappedToUngappedPosition(querySeq, mouseCol)
  if (ungappedPos === undefined) {
    return undefined
  }

  if (mafRegion) {
    const genomePos = mafRegion.start + ungappedPos
    return genomePos < mafRegion.end
      ? { refName: mafRegion.refName, start: genomePos, end: genomePos + 1 }
      : undefined
  }

  if (transcriptToMsaMap) {
    const { refName, p2g } = transcriptToMsaMap
    const s = p2g[ungappedPos]
    const e = p2g[ungappedPos + 1]
    return s !== undefined && e !== undefined
      ? { refName, start: Math.min(s, e), end: Math.max(s, e) }
      : undefined
  }

  return undefined
}
