import BLOSUM62 from './blosum62'

function getScore(a: string, b: string) {
  const upper_a = a.toUpperCase()
  const upper_b = b.toUpperCase()
  return BLOSUM62[upper_a]?.[upper_b] ?? -4
}

const GAP_OPEN = -10
const GAP_EXTEND = -0.5

interface AlignmentResult {
  alignedSeq1: string
  alignedSeq2: string
  score: number
}

export interface AlignmentRow {
  id: string
  seq: string
}

export interface PairwiseAlignment {
  consensus: string
  alns: readonly [AlignmentRow, AlignmentRow]
}

export function needlemanWunsch(
  seq1: string,
  seq2: string,
  gapOpen = GAP_OPEN,
  gapExtend = GAP_EXTEND,
): AlignmentResult {
  const m = seq1.length
  const n = seq2.length

  const M: number[][] = []
  const Ix: number[][] = []
  const Iy: number[][] = []

  for (let i = 0; i <= m; i++) {
    M[i] = []
    Ix[i] = []
    Iy[i] = []
    for (let j = 0; j <= n; j++) {
      M[i]![j] = -Infinity
      Ix[i]![j] = -Infinity
      Iy[i]![j] = -Infinity
    }
  }

  M[0]![0] = 0
  for (let i = 1; i <= m; i++) {
    Ix[i]![0] = gapOpen + (i - 1) * gapExtend
  }
  for (let j = 1; j <= n; j++) {
    Iy[0]![j] = gapOpen + (j - 1) * gapExtend
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const matchScore = getScore(seq1[i - 1]!, seq2[j - 1]!)

      M[i]![j] =
        Math.max(M[i - 1]![j - 1]!, Ix[i - 1]![j - 1]!, Iy[i - 1]![j - 1]!) +
        matchScore

      Ix[i]![j] = Math.max(M[i - 1]![j]! + gapOpen, Ix[i - 1]![j]! + gapExtend)
      Iy[i]![j] = Math.max(M[i]![j - 1]! + gapOpen, Iy[i]![j - 1]! + gapExtend)
    }
  }

  let alignedSeq1 = ''
  let alignedSeq2 = ''
  let i = m
  let j = n

  const finalScores = [M[m]![n]!, Ix[m]![n]!, Iy[m]![n]!]
  const score = Math.max(...finalScores)
  let currentMatrix: 'M' | 'Ix' | 'Iy' =
    score === M[m]![n]! ? 'M' : score === Ix[m]![n]! ? 'Ix' : 'Iy'

  while (i > 0 || j > 0) {
    if (currentMatrix === 'M' && i > 0 && j > 0) {
      alignedSeq1 = seq1[i - 1] + alignedSeq1
      alignedSeq2 = seq2[j - 1] + alignedSeq2

      const matchScore = getScore(seq1[i - 1]!, seq2[j - 1]!)
      const prevM = M[i - 1]![j - 1]!
      const prevIx = Ix[i - 1]![j - 1]!

      if (M[i]![j]! === prevM + matchScore) {
        currentMatrix = 'M'
      } else if (M[i]![j]! === prevIx + matchScore) {
        currentMatrix = 'Ix'
      } else {
        currentMatrix = 'Iy'
      }
      i--
      j--
    } else if (currentMatrix === 'Ix' && i > 0) {
      alignedSeq1 = seq1[i - 1] + alignedSeq1
      alignedSeq2 = '-' + alignedSeq2

      currentMatrix = Ix[i]![j]! === M[i - 1]![j]! + gapOpen ? 'M' : 'Ix'
      i--
    } else if (j > 0) {
      alignedSeq1 = '-' + alignedSeq1
      alignedSeq2 = seq2[j - 1] + alignedSeq2

      currentMatrix = Iy[i]![j]! === M[i]![j - 1]! + gapOpen ? 'M' : 'Iy'
      j--
    } else {
      break
    }
  }

  return { alignedSeq1, alignedSeq2, score }
}

function buildConsensus(alignedSeq1: string, alignedSeq2: string) {
  let consensus = ''
  for (let i = 0; i < alignedSeq1.length; i++) {
    const a = alignedSeq1[i]!
    const b = alignedSeq2[i]!
    if (a === '-' || b === '-') {
      consensus += ' '
    } else if (a.toUpperCase() === b.toUpperCase()) {
      consensus += '|'
    } else {
      consensus += ' '
    }
  }
  return consensus
}

export function runPairwiseAlignment(
  seq1: string,
  seq2: string,
): PairwiseAlignment {
  const { alignedSeq1, alignedSeq2 } = needlemanWunsch(seq1, seq2)

  return {
    consensus: buildConsensus(alignedSeq1, alignedSeq2),
    alns: [
      { id: 'msa', seq: alignedSeq1 },
      { id: 'structure', seq: alignedSeq2 },
    ],
  }
}

export function buildAlignmentMaps(pairwiseAlignment: PairwiseAlignment) {
  const seq1 = pairwiseAlignment.alns[0].seq
  const seq2 = pairwiseAlignment.alns[1].seq

  if (seq1.length !== seq2.length) {
    throw new Error('Aligned sequences must have same length')
  }

  let pos1 = 0
  let pos2 = 0
  const seq1ToSeq2 = new Map<number, number>()
  const seq2ToSeq1 = new Map<number, number>()

  for (let i = 0; i < seq1.length; i++) {
    const c1 = seq1[i]
    const c2 = seq2[i]

    if (c1 !== '-' && c2 !== '-') {
      seq1ToSeq2.set(pos1, pos2)
      seq2ToSeq1.set(pos2, pos1)
      pos1++
      pos2++
    } else if (c1 === '-') {
      pos2++
    } else {
      pos1++
    }
  }

  return { seq1ToSeq2, seq2ToSeq1 }
}
