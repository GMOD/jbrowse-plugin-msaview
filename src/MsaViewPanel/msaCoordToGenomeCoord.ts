/**
 * Convert gapped MSA column coordinate to ungapped sequence coordinate
 * This is the inverse of ungappedCoordMap
 */
function gappedToUngappedCoord(seq: string, gappedPos: number): number {
  let ungappedPos = 0
  for (let i = 0; i < gappedPos && i < seq.length; i++) {
    if (seq[i] !== '-') {
      ungappedPos++
    }
  }
  return ungappedPos
}
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
    rows: string[][]
  }
  coord: number
}) {
  const { querySeqName, transcriptToMsaMap } = model
  if (transcriptToMsaMap === undefined) {
    return undefined
  } else {
    // Get the query sequence
    const queryRow = model.rows.find(f => f[0] === querySeqName)
    const querySeq = queryRow?.[1]
    if (!querySeq) {
      return undefined
    }

    // Check if the position in the query sequence is a gap
    if (querySeq[mouseCol] === '-') {
      return undefined
    }

    // Convert gapped MSA column to ungapped sequence coordinate
    const ungappedPos = gappedToUngappedCoord(querySeq, mouseCol)

    // Use the ungapped position to look up in the p2g map
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
}
