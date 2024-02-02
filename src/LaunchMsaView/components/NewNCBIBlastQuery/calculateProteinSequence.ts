import {
  Feature,
  defaultCodonTable,
  generateCodonTable,
  revcom,
} from '@jbrowse/core/util'

export interface Feat {
  start: number
  end: number
  type: string
}

export function stitch(subfeats: Feat[], sequence: string) {
  return subfeats.map(sub => sequence.slice(sub.start, sub.end)).join('')
}

export function calculateProteinSequence({
  cds,
  sequence,
  codonTable,
}: {
  cds: Feat[]
  sequence: string
  codonTable: Record<string, string>
}) {
  const str = stitch(cds, sequence)
  let protein = ''
  for (let i = 0; i < str.length; i += 3) {
    // use & symbol for undefined codon, or partial slice
    protein += codonTable[str.slice(i, i + 3)] || '&'
  }
  return protein
}

export function revlist(
  list: { start: number; end: number; type: string }[],
  seqlen: number,
) {
  return list
    .map(sub => ({
      ...sub,
      start: seqlen - sub.end,
      end: seqlen - sub.start,
    }))
    .sort((a, b) => a.start - b.start)
}

// filter items if they have the same "ID" or location
function getItemId(feat: Feat) {
  return `${feat.start}-${feat.end}`
}

// filters if successive elements share same start/end
export function dedupe(list: Feat[]) {
  return list.filter(
    (item, pos, ary) => !pos || getItemId(item) !== getItemId(ary[pos - 1]),
  )
}

export function getProteinSequence({
  selectedTranscript,
  seq,
}: {
  seq: string
  selectedTranscript: Feature
}) {
  // @ts-expect-error
  const f = selectedTranscript.toJSON() as {
    start: number
    end: number
    strand: number
    type: string
    subfeatures: { start: number; end: number; type: string }[]
  }
  const cds = dedupe(
    f.subfeatures
      .sort((a, b) => a.start - b.start)
      .map(sub => ({
        ...sub,
        start: sub.start - f.start,
        end: sub.end - f.start,
      }))
      .filter(f => f.type === 'CDS'),
  )

  return calculateProteinSequence({
    cds: f.strand === -1 ? revlist(cds, seq.length) : cds,
    sequence: f.strand === -1 ? revcom(seq) : seq,
    codonTable: generateCodonTable(defaultCodonTable),
  })
}
