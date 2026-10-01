import type { Feature } from '@jbrowse/core/util'

function isCDS(feature: Feature) {
  return feature.get('type')?.toLowerCase() === 'cds'
}

// The feature itself counts: a viral polyprotein hangs its cleavage products
// off its CDS rather than off further CDSs.
export function isCodingFeature(feature: Feature): boolean {
  return isCDS(feature) || !!feature.get('subfeatures')?.some(isCodingFeature)
}
