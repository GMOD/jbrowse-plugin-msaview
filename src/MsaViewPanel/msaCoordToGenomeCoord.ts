import { getCodonRanges } from 'g2p_mapper'

import { gappedToUngappedPosition } from './structureConnection'

import type { MafRegion } from './types'

interface GenomeRegion {
  refName: string
  start: number
  end: number
}

interface CoordModel {
  querySeqName: string
  transcriptToMsaMap:
    | {
        refName: string
        p2gCodon: Record<number, number[]>
      }
    | undefined
  mafRegion?: MafRegion
  rows: string[][]
}

/**
 * The genome regions covered by MSA column `coord` of the query row, in 0-based
 * half-open coordinates (what bpToPx and navTo take).
 *
 * Usually one region -- one codon, or one base in a MAF alignment -- but a
 * codon split across an exon boundary yields one region per contiguous piece,
 * which is why this returns a list.
 */
export function msaCoordToGenomeRegions({
  model,
  coord: mouseCol,
}: {
  model: CoordModel
  coord: number
}): GenomeRegion[] {
  const { querySeqName, transcriptToMsaMap, mafRegion, rows } = model

  const querySeq = rows.find(f => f[0] === querySeqName)?.[1]
  if (!querySeq) {
    return []
  }

  const ungappedPos = gappedToUngappedPosition(querySeq, mouseCol)
  if (ungappedPos === undefined) {
    return []
  }

  if (mafRegion) {
    const genomePos = mafRegion.start + ungappedPos
    return genomePos < mafRegion.end
      ? [{ refName: mafRegion.refName, start: genomePos, end: genomePos + 1 }]
      : []
  }

  if (transcriptToMsaMap) {
    const { refName, p2gCodon } = transcriptToMsaMap
    // p2gCodon holds every genomic base of the codon, so the range is exact on
    // either strand. Deriving it from consecutive p2g entries instead
    // (p2g[pos]..p2g[pos+1]) was off by one base on the reverse strand -- where
    // p2g stores the codon's *highest* coordinate -- dropped the final residue,
    // whose successor has no p2g entry, and spanned the whole intron for a
    // codon split across an exon boundary.
    return (
      getCodonRanges(p2gCodon, ungappedPos)?.map(([start, end]) => ({
        refName,
        start,
        end,
      })) ?? []
    )
  }

  return []
}

/**
 * A single region spanning the codon at MSA column `coord`, for navigation. For
 * a codon split across an exon boundary this spans the intervening intron.
 */
export function msaCoordToGenomeCoord(args: {
  model: CoordModel
  coord: number
}): GenomeRegion | undefined {
  const regions = msaCoordToGenomeRegions(args)
  const first = regions[0]
  const last = regions.at(-1)
  // getCodonRanges returns ranges sorted ascending, so first.start..last.end
  // bounds the codon
  return first && last
    ? { refName: first.refName, start: first.start, end: last.end }
    : undefined
}
