import { genomeToTranscriptSeqMapping } from 'g2p_mapper'

import { isRecord } from './util'

import type { Feat } from 'g2p_mapper'

export const MAX_CODING_BASES = 1_000_000

export type TranscriptMap = ReturnType<typeof genomeToTranscriptSeqMapping> & {
  codingPositions: number[]
}

interface CdsRow {
  start: number
  end: number
  phase?: unknown
}

function isCoordinate(val: unknown): val is number {
  return Number.isSafeInteger(val)
}

function isCds(val: unknown): val is CdsRow {
  return (
    isRecord(val) &&
    typeof val.type === 'string' &&
    val.type.toLowerCase() === 'cds' &&
    isCoordinate(val.start) &&
    isCoordinate(val.end) &&
    val.start < val.end
  )
}

function phaseOf(val: unknown) {
  const phase = Number(val)
  return phase === 1 || phase === 2 ? phase : 0
}

// The rows core's translateTranscript reads, so the query row and the codons
// count alike: the CDS children, or a standalone CDS (a polyprotein's) as its
// own one segment.
function cdsRows(feature: Record<string, unknown>): CdsRow[] {
  const { subfeatures } = feature
  const children = (Array.isArray(subfeatures) ? subfeatures : []).filter(isCds)
  if (children.length > 0) {
    return children
  }
  return isCds(feature) ? [feature] : []
}

function mappableTranscript(
  feature: unknown,
): { transcript: Feat } | { reason: string } {
  if (!isRecord(feature)) {
    return { reason: 'it is not a feature' }
  }
  const { refName, strand } = feature
  if (typeof refName !== 'string' || !refName) {
    return { reason: 'it has no refName' }
  }
  if (strand !== 1 && strand !== -1) {
    return { reason: `its strand is ${JSON.stringify(strand)}, not 1 or -1` }
  }
  const cds = cdsRows(feature).map(f => ({
    refName,
    type: 'CDS',
    start: f.start,
    end: f.end,
    phase: phaseOf(f.phase),
  }))
  if (cds.length === 0) {
    return { reason: 'it has no CDS with numeric start < end' }
  }
  const coding = cds.reduce((sum, f) => sum + f.end - f.start, 0)
  if (coding > MAX_CODING_BASES) {
    return {
      reason: `its CDS covers ${coding} bases, more than any real transcript`,
    }
  }
  return {
    transcript: {
      refName,
      strand,
      start: Math.min(...cds.map(f => f.start)),
      end: Math.max(...cds.map(f => f.end)),
      subfeatures: cds,
    },
  }
}

/**
 * The genome mapping of the linked transcript, or why there is none. The
 * reason reaches the view's notices: a transcript that does not map leaves
 * every genome link dead with nothing else to say so.
 */
export function transcriptMapping(feature: unknown) {
  const checked = mappableTranscript(feature)
  return 'reason' in checked
    ? checked
    : { map: withCodingPositions(checked.transcript) }
}

function withCodingPositions(transcript: Feat) {
  const mapping = genomeToTranscriptSeqMapping(transcript)
  return {
    ...mapping,
    codingPositions: Object.keys(mapping.g2p)
      .map(Number)
      .sort((a, b) => a - b),
  }
}

function lowerBound(sorted: number[], value: number) {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid]! < value) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

export function proteinPositionsInRange(
  map: Pick<TranscriptMap, 'g2p' | 'codingPositions'>,
  start: number,
  end: number,
) {
  const positions = new Set<number>()
  const { codingPositions, g2p } = map
  for (
    let i = lowerBound(codingPositions, start);
    i < codingPositions.length && codingPositions[i]! < end;
    i++
  ) {
    positions.add(g2p[codingPositions[i]!]!)
  }
  return positions
}
