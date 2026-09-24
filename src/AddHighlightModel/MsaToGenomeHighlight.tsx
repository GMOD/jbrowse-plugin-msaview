import React from 'react'

import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { connectedHighlights } from './connectedHighlights'
import { hasHoverPosition, useStyles } from './util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const MsaToGenomeHighlight = observer(function MsaToGenomeHighlight2({
  model,
}: {
  model: LGV
}) {
  const { views, hovered } = getSession(model)
  const highlights = connectedHighlights(
    views,
    model.id,
    hasHoverPosition(hovered),
  )

  return highlights.length ? (
    <MsaToGenomeHighlightRenderer model={model} highlights={highlights} />
  ) : null
})

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
        // bpToPx matches refNames exactly, so canonicalizing "chr17" to "17"
        // would miss a view whose regions say "chr17"
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
