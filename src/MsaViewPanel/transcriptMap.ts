import { genomeToTranscriptSeqMapping } from 'g2p_mapper'

import type { Feat } from 'g2p_mapper'

export const MAX_CODING_BASES = 1_000_000

export type TranscriptMap = ReturnType<typeof genomeToTranscriptSeqMapping> & {
  codingPositions: number[]
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null
}

function isCds(val: unknown): val is Feat {
  return (
    isRecord(val) &&
    val.type === 'CDS' &&
    Number.isSafeInteger(val.start) &&
    Number.isSafeInteger(val.end)
  )
}

function phaseOf(val: unknown) {
  const phase = Number(val)
  return phase === 1 || phase === 2 ? phase : 0
}

function mappableTranscript(
  feature: unknown,
): { transcript: Feat } | { reason: string } {
  if (!isRecord(feature)) {
    return { reason: 'it is not a feature' }
  }
  const { refName, strand, subfeatures } = feature
  if (typeof refName !== 'string' || !refName) {
    return { reason: 'it has no refName' }
  }
  if (strand !== 1 && strand !== -1) {
    return { reason: `its strand is ${JSON.stringify(strand)}, not 1 or -1` }
  }
  const cds = (Array.isArray(subfeatures) ? subfeatures : [])
    .filter(isCds)
    .filter(f => f.start < f.end)
    .map(f => ({ ...f, phase: phaseOf(f.phase) }))
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

const warned = new WeakSet<object>()

export function transcriptMap(feature: unknown): TranscriptMap | undefined {
  const checked = mappableTranscript(feature)
  if ('reason' in checked) {
    if (isRecord(feature) && !warned.has(feature)) {
      warned.add(feature)
      console.warn(
        `[msaview] the linked transcript is not mapped to the genome: ${checked.reason}`,
      )
    }
    return undefined
  }
  const mapping = genomeToTranscriptSeqMapping(checked.transcript)
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
