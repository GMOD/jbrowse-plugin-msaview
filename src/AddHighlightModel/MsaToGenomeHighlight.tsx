import React from 'react'

import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { hasHoverPosition, useStyles } from './util'
import { isMsaView } from '../MsaViewPanel/model'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const MsaToGenomeHighlight = observer(function MsaToGenomeHighlight2({
  model,
}: {
  model: LGV
}) {
  const { views, hovered } = getSession(model)
  const msaView = views
    .filter(isMsaView)
    .find(v => v.connectedViewId === model.id)

  // The persistent click selection always shows. The hover codon is suppressed
  // while hovering the LGV — GenomeMouseoverHighlight handles the single-bp
  // display in that case, so we don't stack a wider codon band on top of it.
  const clickHighlight = msaView?.connectedClickHighlight
  const hoverHighlight = hasHoverPosition(hovered)
    ? undefined
    : msaView?.connectedHoverHighlight
  const highlights = [clickHighlight, hoverHighlight].filter(
    (r): r is { refName: string; start: number; end: number } =>
      r !== undefined,
  )

  return highlights.length ? (
    <MsaToGenomeHighlightRenderer model={model} highlights={highlights} />
  ) : null
})

// Inner component: handles the scroll-dependent rendering
const MsaToGenomeHighlightRenderer = observer(function ({
  model,
  highlights,
}: {
  model: LGV
  highlights: { refName: string; start: number; end: number }[]
}) {
  const { classes } = useStyles()
  const { offsetPx } = model

  return (
    <>
      {highlights.map((r, idx) => {
        // Use the highlight's own refName, which is already in the connected
        // view's coordinate space (it comes from the connectedFeature the
        // launcher set on this LGV). Do NOT canonicalize: bpToPx matches
        // displayed regions by exact refName with no alias resolution, so
        // rewriting e.g. "chr17" to the assembly-canonical "17" misses a view
        // whose regions are "chr17". (GenomeMouseoverHighlight does the same.)
        const s = model.bpToPx({ refName: r.refName, coord: r.start })
        const e = model.bpToPx({ refName: r.refName, coord: r.end })
        if (s && e) {
          const width = Math.max(Math.abs(e.offsetPx - s.offsetPx), 4)
          const left = Math.min(s.offsetPx, e.offsetPx) - offsetPx
          return (
            <div
              key={`${r.refName}-${r.start}-${r.end}-${idx}`}
              className={classes.highlight}
              style={{ left, width }}
            />
          )
        }
        return null
      })}
    </>
  )
})

export default MsaToGenomeHighlight
