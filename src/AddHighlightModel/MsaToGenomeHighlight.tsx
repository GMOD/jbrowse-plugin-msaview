import React from 'react'

import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { hasHoverPosition, useStyles } from './util'
import { isMsaView } from '../MsaViewPanel/model'
import { getCanonicalRefName } from '../MsaViewPanel/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const MsaToGenomeHighlight = observer(function MsaToGenomeHighlight2({
  model,
}: {
  model: LGV
}) {
  const { views, hovered } = getSession(model)
  const msaView = views.filter(isMsaView).find(v => v.connectedViewId === model.id)
  const highlights = msaView?.connectedHighlights

  // Suppress codon highlight while hovering the LGV — GenomeMouseoverHighlight
  // handles the single-bp display in that case
  return !hasHoverPosition(hovered) && highlights?.length ? (
    <MsaToGenomeHighlightRenderer
      model={model}
      highlights={highlights}
    />
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
  const { assemblyManager } = getSession(model)
  const { offsetPx } = model

  return (
    <>
      {highlights.map((r, idx) => {
        const refName = getCanonicalRefName({
          assemblyManager,
          assemblyNames: model.assemblyNames,
          refName: r.refName,
        })
        const s = model.bpToPx({ refName, coord: r.start })
        const e = model.bpToPx({ refName, coord: r.end })
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
