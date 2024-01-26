import {
  Feature,
  defaultCodonTable,
  generateCodonTable,
  revcom,
} from '@jbrowse/core/util'
import { calculateProteinSequence } from './calculateProteinSequence'

export function getTranscriptFeatures(feature: Feature) {
  // check if we are looking at a 'two-level' or 'three-level' feature by
  // finding exon/CDS subfeatures. we want to select from transcript names
  const subfeatures = feature.get('subfeatures') ?? []
  return subfeatures.some(f => f.get('type') === 'CDS')
    ? [feature]
    : // filter out non-coding by finding subfeatures with CDS subfeatures
      subfeatures.filter(f =>
        f.get('subfeatures')?.some(f => f.get('type') === 'CDS'),
      )
}
export function getId(val?: Feature) {
  return val === undefined ? '' : val.get('name') || val.get('id')
}

export function getTranscriptDisplayName(val?: Feature) {
  return val === undefined
    ? ''
    : [val.get('name'), val.get('id')].filter(f => !!f).join(' ')
}

export function getGeneDisplayName(val?: Feature) {
  return val === undefined
    ? ''
    : [val.get('gene_name') || val.get('name'), val.get('id')]
        .filter(f => !!f)
        .join(' ')
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
  const cds = f.subfeatures
    .sort((a, b) => a.start - b.start)
    .map(sub => ({
      ...sub,
      start: sub.start - f.start,
      end: sub.end - f.start,
    }))
    .filter(f => f.type === 'CDS')

  return calculateProteinSequence({
    cds: f.strand === -1 ? revlist(cds, seq.length) : cds,
    sequence: f.strand === -1 ? revcom(seq) : seq,
    codonTable: generateCodonTable(defaultCodonTable),
  })
}
