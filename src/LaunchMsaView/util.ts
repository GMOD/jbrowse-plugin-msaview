import { getContainingView, sum } from '@jbrowse/core/util'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getLinearGenomeView(model: AbstractTrackModel) {
  return getContainingView(model) as LinearGenomeViewModel
}

function uniqueDefined(vals: (string | undefined)[]): string[] {
  return [...new Set(vals.filter((v): v is string => !!v))]
}

function joinDefined(sep: string, parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => !!p).join(sep)
}

export function getTranscriptFeatures(feature: Feature) {
  // check if we are looking at a 'two-level' or 'three-level' feature by
  // finding exon/CDS subfeatures. we want to select from transcript names
  const subfeatures = feature.get('subfeatures') ?? []

  // Check for mRNA/transcript subfeatures (three-level: gene → mRNA → CDS)
  // Filter to only those that have CDS subfeatures (i.e. are coding)
  const transcripts = subfeatures.filter(
    (f: Feature) =>
      (f.get('type') === 'mRNA' || f.get('type') === 'transcript') &&
      f.get('subfeatures')?.some((s: Feature) => s.get('type') === 'CDS'),
  )
  if (transcripts.length > 0) {
    return transcripts
  }

  // Has direct CDS children, treat feature itself as the transcript
  // (two-level: gene → CDS or mRNA → CDS)
  return [feature]
}

export function getTranscriptLength(feature: Feature) {
  const cdsLen = sum(
    feature
      .get('subfeatures')
      ?.filter(f => f.get('type') === 'CDS')
      .map(s => s.get('end') - s.get('start')) ?? [],
  )
  return {
    len: Math.floor(cdsLen / 3),
    mod: cdsLen % 3,
  }
}
export function getId(val?: Feature): string {
  return val?.id() ?? ''
}

export function getMatchableIds(val?: Feature): string[] {
  return val
    ? uniqueDefined([
        val.id(),
        val.get('name'),
        val.get('id'),
        val.get('transcript_id'),
      ])
    : []
}

export function featureMatchesId(feature: Feature, id: string): boolean {
  return getMatchableIds(feature).includes(id)
}

export function getTranscriptDisplayName(val?: Feature) {
  return val ? joinDefined(' ', [val.get('name'), val.get('id')]) : ''
}

export function getGeneDisplayName(val?: Feature) {
  return val
    ? joinDefined(' ', [
        val.get('gene_name') ?? val.get('name'),
        val.get('id') ? `(${val.get('id')})` : undefined,
      ])
    : ''
}

export function getBlastViewTitle(feature: Feature, transcript: Feature) {
  return `BLAST - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(transcript)}`
}

export function getSortedTranscriptFeatures(feature: Feature) {
  const transcripts = getTranscriptFeatures(feature)
  return transcripts.toSorted(
    (a, b) => getTranscriptLength(b).len - getTranscriptLength(a).len,
  )
}

export function cleanProteinSequence(seq: string) {
  return seq.replaceAll('*', '').replaceAll('&', '')
}

export function getGeneIdentifiers(feature: Feature): string[] {
  return uniqueDefined([
    feature.id(),
    feature.get('id'),
    feature.get('name'),
    feature.get('gene_id'),
    feature.get('gene_name'),
  ])
}
