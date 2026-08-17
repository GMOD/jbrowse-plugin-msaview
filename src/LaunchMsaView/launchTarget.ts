import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

// The canvas LinearBasicDisplay (JBrowse >=4.3) exposes the right-clicked
// feature via contextMenuInfo + async fetchFullFeature. Hosts before that -- and
// the v3.7.0 in the wild that shipped configs still name -- expose it
// synchronously as contextMenuFeature, and only have that one.
export interface ContextMenuInfo {
  item: { featureId: string; type?: string }
  displayedRegionIndex: number
}

export interface DisplayModel {
  contextMenuItems: () => MenuItem[]
  contextMenuInfo?: ContextMenuInfo
  fetchFullFeature?: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<Feature | undefined>
  contextMenuFeature?: Feature
}

// Read off the clicked item rather than off the display.
//
// LinearBasicDisplay used to publish an `isGeneLike` getter and this gated on
// it. jbrowse-components 684142b3 (2026-08-16) inlined that getter into its own
// `contextMenuItems`, and every host built after it returns `undefined` here --
// so the gate was never satisfied, `onClick` stayed undefined, and the item
// silently left the right-click menu on every gene track. Nothing failed loudly:
// the display still had contextMenuInfo and fetchFullFeature, and the menu still
// opened with its own items in it.
//
// A predicate over the type we were already given cannot go the same way, and it
// costs one comparison. Deliberately the same loose case-insensitive test the
// host applies (`isGeneLikeType` in collapseIntronsMenu.ts): real GFFs carry
// 'mRNA', 'lnc_RNA', 'protein_coding_gene', 'transcript'.
export function isGeneLikeType(type: unknown) {
  const t = String(type ?? '').toLowerCase()
  return t.includes('gene') || t.includes('rna') || t.includes('transcript')
}

/**
 * How to get the right-clicked feature, or nothing when there is no gene to
 * launch on. Both host shapes reduce to a thunk, so the menu item is built and
 * the dialog is opened by one code path — and the same gene test decides both.
 * The strict three-name set the legacy branch used to carry disagreed with the
 * loose one above, so a `lnc_RNA` offered the menu item on a 4.3 host and not
 * on a 3.7 one.
 */
export function launchTarget(self: DisplayModel) {
  const info = self.contextMenuInfo
  const fetchFullFeature = self.fetchFullFeature
  // exclusive, not a fallthrough: a display publishing contextMenuInfo has
  // already said what was clicked, and reading contextMenuFeature after it
  // rejects the click can only answer with some other feature
  if (info && fetchFullFeature) {
    return isGeneLikeType(info.item.type)
      ? () => fetchFullFeature(info.item.featureId, info.displayedRegionIndex)
      : undefined
  }
  const legacy = self.contextMenuFeature
  return legacy && isGeneLikeType(legacy.get('type'))
    ? () => Promise.resolve(legacy)
    : undefined
}
