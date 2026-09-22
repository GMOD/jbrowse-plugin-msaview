import { geneLikeRoot, isGeneLikeType, isKnownNonCoding } from './codingFeature'

import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

// The canvas LinearBasicDisplay (JBrowse >=4.3) exposes the right-clicked
// feature via contextMenuInfo + async fetchFullFeature. Hosts before that -- and
// the v3.7.0 in the wild that shipped configs still name -- expose it
// synchronously as contextMenuFeature, and only have that one.
export interface ContextMenuInfo {
  item: { featureId: string; type?: string }
  // the isoform under the pointer when the click landed on a gene's child
  subfeature?: { featureId: string }
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

/**
 * What the menu item launches on. A legacy host hands over the whole feature,
 * so whether it codes for anything is known while the menu is built; a canvas
 * host's hit test carries a type and an id, so that question can only be
 * answered after the fetch, and the caller answers it there.
 */
interface ClickedTranscript {
  /**
   * The isoform the click actually landed on, when the dialog opens on its
   * gene. Climbing to the gene is what puts every isoform in the picker, and it
   * threw away which one the user pointed at: the picker then opened on the
   * longest transcript, and on a v4 host that is the only place the choice was
   * ever stated.
   */
  preferredTranscriptId?: string
}

export type MenuTarget =
  | (ClickedTranscript & { feature: Feature })
  | (ClickedTranscript & {
      fetchFeature: () => Promise<Feature | undefined>
    })

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
export { isGeneLikeType }

/**
 * How to get the right-clicked feature, or nothing when there is nothing to
 * launch on. Both host shapes reduce to one target, so the menu item is built
 * and the dialog is opened by one code path — and the same gene test decides
 * both. The strict three-name set the legacy branch used to carry disagreed
 * with the loose one above, so a `lnc_RNA` offered the menu item on a 4.3 host
 * and not on a 3.7 one.
 *
 * Gene-like is not enough on its own: an lncRNA has no protein to align, and
 * accepting it opened a dialog whose Submit never left grey, with nothing
 * saying why. Where the whole feature is in hand the CDS decides here -- but
 * only where there are subfeatures to read it off, since a feature that came
 * with none has not answered the question.
 */
export function launchTarget(self: DisplayModel): MenuTarget | undefined {
  const info = self.contextMenuInfo
  const fetchFullFeature = self.fetchFullFeature
  // exclusive, not a fallthrough: a display publishing contextMenuInfo has
  // already said what was clicked, and reading contextMenuFeature after it
  // rejects the click can only answer with some other feature
  if (info && fetchFullFeature) {
    return isGeneLikeType(info.item.type)
      ? {
          fetchFeature: () =>
            fetchFullFeature(info.item.featureId, info.displayedRegionIndex),
          preferredTranscriptId: info.subfeature?.featureId,
        }
      : undefined
  }
  const legacy = self.contextMenuFeature
  if (!legacy) {
    return undefined
  }
  const root = geneLikeRoot(legacy)
  return isGeneLikeType(root.get('type')) && !isKnownNonCoding(root)
    ? { feature: root, preferredTranscriptId: legacy.id() }
    : undefined
}
