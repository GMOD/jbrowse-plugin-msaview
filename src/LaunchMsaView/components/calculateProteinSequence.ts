import {
  dedupe,
  defaultCodonTable,
  generateCodonTable,
  revcom,
} from '@jbrowse/core/util'

import type { Feat } from './types'
import type { Feature } from '@jbrowse/core/util'

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
    protein += codonTable[str.slice(i, i + 3)] ?? '&'
  }
  return protein
}

export function revlist(list: Feat[], seqlen: number) {
  return list
    .map(sub => ({
      ...sub,
      start: seqlen - sub.end,
      end: seqlen - sub.start,
    }))
    .toSorted((a, b) => a.start - b.start)
}

export function getProteinSequenceFromFeature({
  feature,
  seq,
}: {
  seq: string
  feature: Feature
}) {
  const { subfeatures, start, strand } = feature.toJSON()
  const cds = dedupe(
    subfeatures
      ?.toSorted((a, b) => a.start - b.start)
      .map(sub => ({
        ...sub,
        start: sub.start - start,
        end: sub.end - start,
      }))
      .filter(subfeature => subfeature.type === 'CDS') ?? [],
    feat => `${feat.start}-${feat.end}`,
  )

  return calculateProteinSequence({
    cds: strand === -1 ? revlist(cds, seq.length) : cds,
    sequence: strand === -1 ? revcom(seq) : seq,
    codonTable: generateCodonTable(defaultCodonTable),
  })
}
