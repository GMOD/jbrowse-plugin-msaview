import type { Region } from 'react-msaview'

interface RegionModel {
  region?: Region
  viewInitialized: boolean
  numColumns: number
  treeFilehandle?: unknown
  data: { tree?: string }
  zoomToRegion: (region: Region) => void
  setRegion: (region?: Region) => void
}

/**
 * Zoom onto the launch's `region` once, then forget it, so a reloaded session
 * opens where the reader left it rather than back on the region.
 *
 * zoomToRegion is a no-op until the view has a width, and it resolves residues
 * through the visible columns, so it waits for the alignment and for a tree
 * file too: a clade the tree collapses hides columns and would move the
 * target after the zoom.
 */
export function applyRegion(self: RegionModel) {
  const { region } = self
  if (
    region &&
    self.viewInitialized &&
    self.numColumns > 0 &&
    !(self.treeFilehandle && !self.data.tree)
  ) {
    self.zoomToRegion(region)
    self.setRegion(undefined)
  }
}
