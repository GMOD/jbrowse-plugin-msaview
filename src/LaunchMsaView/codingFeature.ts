import type { Feature } from '@jbrowse/core/util'

// Copied from @jbrowse/core's featureTypes rather than imported: the barrel
// only exports it from v5, and a bundle resolving it on a v4 host reads
// undefined.
const GENE_LIKE_TYPE = /gene(_segment)?$|rna$|transcript/

// `unknown` rather than `string | undefined`, because the type comes off a
// host's hit-test item and nothing here built it.
export function isGeneLikeType(type: unknown) {
  return typeof type === 'string' && GENE_LIKE_TYPE.test(type.toLowerCase())
}

function isCDS(feature: Feature) {
  return feature.get('type')?.toLowerCase() === 'cds'
}

// The feature itself counts: a viral polyprotein hangs its cleavage products
// off its CDS rather than off further CDSs.
export function isCodingFeature(feature: Feature): boolean {
  return isCDS(feature) || !!feature.get('subfeatures')?.some(isCodingFeature)
}

/**
 * Whether the feature is known not to code for anything.
 *
 * Not simply `!isCodingFeature`: a feature that arrived with no subfeatures at
 * all says nothing either way, and a host is free to hand one over that way.
 * Reading that as "no protein here" takes the menu item off a perfectly
 * ordinary gene, silently, which is worse than opening a dialog that then has
 * nothing to translate.
 */
export function isKnownNonCoding(feature: Feature) {
  return !!feature.get('subfeatures')?.length && !isCodingFeature(feature)
}

// The outermost gene-like ancestor, so a click on an isoform opens the dialog
// on the gene with every transcript to choose from, as the canvas host does.
export function geneLikeRoot(feature: Feature) {
  let root = feature
  for (
    let parent = root.parent?.();
    parent && isGeneLikeType(parent.get('type'));
    parent = parent.parent?.()
  ) {
    root = parent
  }
  return root
}
