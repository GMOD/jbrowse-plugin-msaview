import { Feature } from '@jbrowse/core/util'

export function getTranscriptFeatures(feature: Feature) {
  // check if we are looking at a 'two-level' or 'three-level' feature by
  // finding exon/CDS subfeatures. we want to select from transcript names
  const subfeatures = feature.get('subfeatures') ?? []
  return subfeatures.some(
    f => f.get('type') === 'CDS' || f.get('type') === 'exon',
  )
    ? [feature]
    : subfeatures
}
export function getId(val?: Feature) {
  return val !== undefined ? val.get('name') || val.get('id') : ''
}

export function getDisplayName(val?: Feature) {
  return val !== undefined
    ? [val.get('name'), val.get('id')].filter(f => !!f).join(' ')
    : ''
}