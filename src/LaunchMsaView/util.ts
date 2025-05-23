import { sum } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

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

export function getTranscriptLength(feature: Feature) {
  const cdsLen = sum(
    feature
      .get('subfeatures')
      ?.filter(f => f.get('type').toLowerCase() === 'cds')
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
    : [val.get('gene_name') ?? val.get('name'), val.get('id')]
        .filter(f => !!f)
        .join(' ')
}

export function getGeneDisplayName2(val?: Feature) {
  return val === undefined
    ? ''
    : [
        val.get('gene_name') ?? val.get('name'),
        val.get('id') ? `(${val.get('id')})` : '',
      ]
        .filter(f => !!f)
        .join(' ')
}
