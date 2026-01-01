import { sum } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

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
      ?.filter(
        f => (f.get('type') as string | undefined)?.toLowerCase() === 'cds',
      )
      .map(s => s.get('end') - s.get('start')) ?? [],
  )
  return {
    len: Math.floor(cdsLen / 3),
    mod: cdsLen % 3,
  }
}
export function getId(val?: Feature): string {
  return val?.get('name') ?? val?.get('id') ?? ''
}

export function getTranscriptDisplayName(val?: Feature) {
  return val === undefined
    ? ''
    : [val.get('name'), val.get('id')].filter(f => !!f).join(' ')
}

export function getGeneDisplayName(val?: Feature) {
  return val === undefined
    ? ''
    : [
        val.get('gene_name') ?? val.get('name'),
        val.get('id') ? `(${val.get('id')})` : '',
      ]
        .filter(f => !!f)
        .join(' ')
}
