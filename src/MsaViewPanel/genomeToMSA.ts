import { getSession } from '@jbrowse/core/util'

import {
  hasHoverPosition,
  hasQueryRow,
  transcriptPosToVisibleCol,
} from './util'

import type { JBrowsePluginMsaViewModel } from './model'

export function genomeToMSA({ model }: { model: JBrowsePluginMsaViewModel }) {
  const { assemblyManager, hovered } = getSession(model)
  const { querySeqName, transcriptToMsaMap, connectedView, mafRegion } = model

  if (
    !connectedView?.initialized ||
    !hasHoverPosition(hovered) ||
    !hasQueryRow(model)
  ) {
    return undefined
  }

  const { coord, refName } = hovered.hoverPosition

  // hoverPosition.coord is a 1-based display coordinate (core's pxToBp adds the
  // +1), while g2p and mafRegion are keyed by 0-based genome position
  const genomePos = coord - 1

  // The two sides name the chromosome differently. A hover carries the
  // assembly's canonical name -- `1` on jbrowse.org's hg38 -- while mafRegion
  // and the transcript's g2p map carry the feature's, straight out of the
  // annotation file, which is `chr1` in GENCODE. Compared raw they agree only
  // where a config happens to pair files that agree, and everywhere else
  // hovering a codon lit nothing at all, with no throw and no console line.
  const assembly = assemblyManager.get(
    mafRegion?.assemblyName ?? connectedView.assemblyNames[0] ?? '',
  )
  const canonical = (name: string) =>
    assembly?.getCanonicalRefName(name) ?? name
  const hoveredRefName = canonical(refName)

  if (mafRegion) {
    if (
      hoveredRefName !== canonical(mafRegion.refName) ||
      !connectedView.assemblyNames.includes(mafRegion.assemblyName) ||
      genomePos < mafRegion.start ||
      genomePos >= mafRegion.end
    ) {
      return undefined
    }
    return model.seqPosToVisibleCol(querySeqName, genomePos - mafRegion.start)
  }

  // session.hovered is global -- set by whichever LinearGenomeView the cursor
  // was last over, on any assembly -- so the refName gate is load bearing:
  // without it the same numeric coordinate on an unrelated chromosome matches a
  // g2p key and lights up a column for a different locus
  if (
    transcriptToMsaMap &&
    hoveredRefName === canonical(transcriptToMsaMap.refName)
  ) {
    const proteinPos = transcriptToMsaMap.g2p[genomePos]
    if (proteinPos !== undefined) {
      return transcriptPosToVisibleCol(model, proteinPos)
    }
  }

  return undefined
}
