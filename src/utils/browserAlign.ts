import { timeout } from './fetch'

// A query-anchored alignment built in the browser, so a homolog panel needs no
// alignment job at EBI at all.
//
// Every target is aligned to the query on its own -- BLOSUM62, affine gaps,
// free end gaps so a domain-only homolog is not charged for the query's
// flanks -- and the pairwise alignments are merged on the query: one column
// per query residue, and between two query residues as many insert columns as
// the longest insertion any target put there. That is the alignment a search
// tool hands back anyway (phmmer's profile has one match state per query
// residue, BLAST reports each hit against the query), and it is exact where
// the genome connection needs it: the query row is the query, residue for
// residue, so `connectedFeature` maps every column to its codon.
//
// What it is not is a progressive alignment: two targets agree with each other
// only through the query, so a region absent from the query -- an insert --
// is padded, not aligned. `allowedGappyness` hides those columns in the view.

// prettier-ignore
const BLOSUM62_KEYS = 'ARNDCQEGHILKMFPSTWYVBZX*'
// prettier-ignore
const BLOSUM62_DATA = [
  [ 4,-1,-2,-2, 0,-1,-1, 0,-2,-1,-1,-1,-1,-2,-1, 1, 0,-3,-2, 0,-2,-1, 0,-4],
  [-1, 5, 0,-2,-3, 1, 0,-2, 0,-3,-2, 2,-1,-3,-2,-1,-1,-3,-2,-3,-1, 0,-1,-4],
  [-2, 0, 6, 1,-3, 0, 0, 0, 1,-3,-3, 0,-2,-3,-2, 1, 0,-4,-2,-3, 3, 0,-1,-4],
  [-2,-2, 1, 6,-3, 0, 2,-1,-1,-3,-4,-1,-3,-3,-1, 0,-1,-4,-3,-3, 4, 1,-1,-4],
  [ 0,-3,-3,-3, 9,-3,-4,-3,-3,-1,-1,-3,-1,-2,-3,-1,-1,-2,-2,-1,-3,-3,-2,-4],
  [-1, 1, 0, 0,-3, 5, 2,-2, 0,-3,-2, 1, 0,-3,-1, 0,-1,-2,-1,-2, 0, 3,-1,-4],
  [-1, 0, 0, 2,-4, 2, 5,-2, 0,-3,-3, 1,-2,-3,-1, 0,-1,-3,-2,-2, 1, 4,-1,-4],
  [ 0,-2, 0,-1,-3,-2,-2, 6,-2,-4,-4,-2,-3,-3,-2, 0,-2,-2,-3,-3,-1,-2,-1,-4],
  [-2, 0, 1,-1,-3, 0, 0,-2, 8,-3,-3,-1,-2,-1,-2,-1,-2,-2, 2,-3, 0, 0,-1,-4],
  [-1,-3,-3,-3,-1,-3,-3,-4,-3, 4, 2,-3, 1, 0,-3,-2,-1,-3,-1, 3,-3,-3,-1,-4],
  [-1,-2,-3,-4,-1,-2,-3,-4,-3, 2, 4,-2, 2, 0,-3,-2,-1,-2,-1, 1,-4,-3,-1,-4],
  [-1, 2, 0,-1,-3, 1, 1,-2,-1,-3,-2, 5,-1,-3,-1, 0,-1,-3,-2,-2, 0, 1,-1,-4],
  [-1,-1,-2,-3,-1, 0,-2,-3,-2, 1, 2,-1, 5, 0,-2,-1,-1,-1,-1, 1,-3,-1,-1,-4],
  [-2,-3,-3,-3,-2,-3,-3,-3,-1, 0, 0,-3, 0, 6,-4,-2,-2, 1, 3,-1,-3,-3,-1,-4],
  [-1,-2,-2,-1,-3,-1,-1,-2,-2,-3,-3,-1,-2,-4, 7,-1,-1,-4,-3,-2,-2,-1,-2,-4],
  [ 1,-1, 1, 0,-1, 0, 0, 0,-1,-2,-2, 0,-1,-2,-1, 4, 1,-3,-2,-2, 0, 0, 0,-4],
  [ 0,-1, 0,-1,-1,-1,-1,-2,-2,-1,-1,-1,-1,-2,-1, 1, 5,-2,-2, 0,-1,-1, 0,-4],
  [-3,-3,-4,-4,-2,-2,-3,-2,-2,-3,-2,-3,-1, 1,-4,-3,-2,11, 2,-3,-4,-3,-2,-4],
  [-2,-2,-2,-3,-2,-1,-2,-3, 2,-1,-1,-2,-1, 3,-3,-2,-2, 2, 7,-1,-3,-2,-1,-4],
  [ 0,-3,-3,-3,-1,-2,-2,-3,-3, 3, 1,-2, 1,-1,-2,-2, 0,-3,-1, 4,-3,-2,-1,-4],
  [-2,-1, 3, 4,-3, 0, 1,-1, 0,-3,-4, 0,-3,-3,-2, 0,-1,-4,-3,-3, 4, 1,-1,-4],
  [-1, 0, 0, 1,-3, 3, 4,-2, 0,-3,-3, 1,-1,-3,-1, 0,-1,-3,-2,-2, 1, 4,-1,-4],
  [ 0,-1,-1,-1,-2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-2, 0, 0,-2,-1,-1,-1,-1,-1,-4],
  [-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4,-4, 1],
]

const NUM_SYMBOLS = BLOSUM62_KEYS.length
const BLOSUM62 = Int8Array.from(BLOSUM62_DATA.flat())
const UNKNOWN = BLOSUM62_KEYS.indexOf('X')

const symbolOfCode = new Uint8Array(128).fill(UNKNOWN)
for (let i = 0; i < NUM_SYMBOLS; i++) {
  const key = BLOSUM62_KEYS[i]!
  symbolOfCode[key.charCodeAt(0)] = i
  symbolOfCode[key.toLowerCase().charCodeAt(0)] = i
}

function encode(seq: string) {
  const out = new Uint8Array(seq.length)
  for (let i = 0; i < seq.length; i++) {
    const code = seq.charCodeAt(i)
    out[i] = code < 128 ? symbolOfCode[code]! : UNKNOWN
  }
  return out
}

const GAP_OPEN = 11
const GAP_EXTEND = 1
const NEG = -1_000_000

const M = 0
const X = 1
const Y = 2

/**
 * One target against the query, as the pieces the merge needs: the target
 * residue (or gap) under each query residue, and the target residues inserted
 * before each query residue -- `inserts[query.length]` being what follows the
 * last one.
 */
export interface QueryAnchored {
  matched: string[]
  inserts: string[]
}

/**
 * Gotoh's affine-gap alignment with free end gaps on both sequences. Three
 * states -- M pairs two residues, X puts a query residue against a gap, Y puts
 * a target residue against a gap -- with rolling score rows and one byte of
 * traceback per state per cell.
 */
export function alignToQuery(query: string, target: string): QueryAnchored {
  const q = encode(query)
  const t = encode(target)
  const n = q.length
  const m = t.length
  const w = m + 1

  const ptrM = new Int8Array((n + 1) * w)
  const ptrX = new Int8Array((n + 1) * w)
  const ptrY = new Int8Array((n + 1) * w)

  let prevM = new Int32Array(w)
  let prevX = new Int32Array(w)
  let prevY = new Int32Array(w)
  let curM = new Int32Array(w)
  let curX = new Int32Array(w)
  let curY = new Int32Array(w)

  // leading gaps are free: a target that starts inside the query, or a query
  // that starts inside the target, pays nothing for the overhang
  prevM[0] = 0
  prevX[0] = NEG
  prevY[0] = NEG
  for (let j = 1; j <= m; j++) {
    prevM[j] = NEG
    prevX[j] = NEG
    prevY[j] = 0
  }

  let best = NEG
  let bestI = 0
  let bestJ = 0
  let bestState = M

  for (let i = 1; i <= n; i++) {
    curM[0] = NEG
    curX[0] = 0
    curY[0] = NEG
    const qi = q[i - 1]! * NUM_SYMBOLS
    const row = i * w
    for (let j = 1; j <= m; j++) {
      const s = BLOSUM62[qi + t[j - 1]!]!

      // M: from any state at (i-1, j-1)
      let mScore = prevM[j - 1]!
      let mFrom = M
      if (prevX[j - 1]! > mScore) {
        mScore = prevX[j - 1]!
        mFrom = X
      }
      if (prevY[j - 1]! > mScore) {
        mScore = prevY[j - 1]!
        mFrom = Y
      }
      curM[j] = mScore + s
      ptrM[row + j] = mFrom

      // X: query residue i against a gap, from (i-1, j)
      let xScore = prevM[j]! - GAP_OPEN
      let xFrom = M
      if (prevX[j]! - GAP_EXTEND > xScore) {
        xScore = prevX[j]! - GAP_EXTEND
        xFrom = X
      }
      if (prevY[j]! - GAP_OPEN > xScore) {
        xScore = prevY[j]! - GAP_OPEN
        xFrom = Y
      }
      curX[j] = xScore
      ptrX[row + j] = xFrom

      // Y: target residue j against a gap, from (i, j-1)
      let yScore = curM[j - 1]! - GAP_OPEN
      let yFrom = M
      if (curY[j - 1]! - GAP_EXTEND > yScore) {
        yScore = curY[j - 1]! - GAP_EXTEND
        yFrom = Y
      }
      if (curX[j - 1]! - GAP_OPEN > yScore) {
        yScore = curX[j - 1]! - GAP_OPEN
        yFrom = X
      }
      curY[j] = yScore
      ptrY[row + j] = yFrom
    }

    // trailing gaps are free too, so the alignment may end anywhere on the
    // last column (query exhausted) or the last row (target exhausted)
    for (const [state, arr] of [
      [M, curM],
      [X, curX],
      [Y, curY],
    ] as const) {
      if (arr[m]! > best) {
        best = arr[m]!
        bestI = i
        bestJ = m
        bestState = state
      }
    }
    if (i === n) {
      for (let j = 0; j < m; j++) {
        for (const [state, arr] of [
          [M, curM],
          [X, curX],
          [Y, curY],
        ] as const) {
          if (arr[j]! > best) {
            best = arr[j]!
            bestI = n
            bestJ = j
            bestState = state
          }
        }
      }
    }

    ;[prevM, curM] = [curM, prevM]
    ;[prevX, curX] = [curX, prevX]
    ;[prevY, curY] = [curY, prevY]
  }

  const matched = Array.from<string>({ length: n }).fill('-')
  const inserts = Array.from<string>({ length: n + 1 }).fill('')

  // whatever lies past the end point is an overhang: target residues after the
  // last aligned pair are an insert after the query, query residues after it
  // sit over gaps (already the default)
  inserts[n] = target.slice(bestJ)
  let i = bestI
  let j = bestJ
  let state = bestState
  let pending: string[] = []
  const flushInsert = (at: number) => {
    if (pending.length) {
      inserts[at] = pending.reverse().join('') + inserts[at]!
      pending = []
    }
  }
  while (i > 0 && j > 0) {
    const idx = i * w + j
    if (state === M) {
      flushInsert(i)
      matched[i - 1] = target[j - 1]!
      state = ptrM[idx]!
      i--
      j--
    } else if (state === X) {
      flushInsert(i)
      state = ptrX[idx]!
      i--
    } else {
      pending.push(target[j - 1]!)
      state = ptrY[idx]!
      j--
    }
  }
  flushInsert(i)
  // a leading target overhang goes before the first query residue
  inserts[0] = target.slice(0, j) + inserts[0]!
  return { matched, inserts }
}

export interface NamedSequence {
  name: string
  sequence: string
}

/** Merge per-target alignments on the query into one set of equal-length rows. */
export function mergeOnQuery(
  query: NamedSequence,
  aligned: { name: string; alignment: QueryAnchored }[],
) {
  const n = query.sequence.length
  const insertLength = new Array<number>(n + 1).fill(0)
  for (const { alignment } of aligned) {
    for (let i = 0; i <= n; i++) {
      insertLength[i] = Math.max(insertLength[i]!, alignment.inserts[i]!.length)
    }
  }
  const rowOf = (matched: string[], inserts: string[]) => {
    const parts: string[] = []
    for (let i = 0; i <= n; i++) {
      parts.push(inserts[i]!.padEnd(insertLength[i]!, '-'))
      if (i < n) {
        parts.push(matched[i]!)
      }
    }
    return parts.join('')
  }
  return [
    {
      name: query.name,
      sequence: rowOf(
        query.sequence.split(''),
        Array.from<string>({ length: n + 1 }).fill(''),
      ),
    },
    ...aligned.map(({ name, alignment }) => ({
      name,
      sequence: rowOf(alignment.matched, alignment.inserts),
    })),
  ]
}

// how many targets to align between two yields to the event loop, so the
// progress text moves and a cancel is honoured mid-way
const BATCH = 8

/**
 * Align `targets` to `query` in the browser and return the rows as FASTA, the
 * query first. Yields between batches so the UI stays responsive; the returned
 * FASTA is what the rest of the launch pipeline expects an aligner to produce.
 */
export async function alignInBrowser({
  query,
  targets,
  onProgress,
  signal,
}: {
  query: NamedSequence
  targets: NamedSequence[]
  onProgress?: (arg: string) => void
  signal?: AbortSignal
}) {
  const aligned: { name: string; alignment: QueryAnchored }[] = []
  for (let i = 0; i < targets.length; i += BATCH) {
    onProgress?.(
      `Aligning ${Math.min(i + BATCH, targets.length)} of ${targets.length} sequences in the browser...`,
    )
    await timeout(0, signal)
    for (const target of targets.slice(i, i + BATCH)) {
      aligned.push({
        name: target.name,
        alignment: alignToQuery(query.sequence, target.sequence),
      })
    }
  }
  return mergeOnQuery(query, aligned)
    .map(r => `>${r.name}\n${r.sequence}`)
    .join('\n')
}

/** The first record is the query, the rest the targets: the shape every launch submits. */
export function parseFastaRecords(text: string): NamedSequence[] {
  const records: NamedSequence[] = []
  for (const block of text.split('>')) {
    const [header, ...lines] = block.split('\n')
    const name = header?.trim().split(/\s+/)[0]
    if (name) {
      records.push({
        name,
        sequence: lines.join('').replaceAll(/[\s*-]/g, ''),
      })
    }
  }
  return records
}
