import React from 'react'

import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { useStyles } from './util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function hasHoverPosition(
  hovered: unknown,
): hovered is { hoverPosition: unknown } {
  return !!hovered && typeof hovered === 'object' && 'hoverPosition' in hovered
}

const GenomeMouseoverHighlight = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { hovered, views } = getSession(model)
  const hasMsaView = views.some(s => s.type === 'MsaView')
  return hasMsaView && hasHoverPosition(hovered) ? (
    <GenomeMouseoverHighlightRenderer model={model} hovered={hovered} />
  ) : null
})

const GenomeMouseoverHighlightRenderer = observer(function ({
  model,
  hovered,
}: {
  model: LinearGenomeViewModel
  hovered: { hoverPosition: unknown }
}) {
  const { classes } = useStyles()
  const { offsetPx } = model
  const { coord, refName } = hovered.hoverPosition as {
    coord: number
    refName: string
  }

  const s = model.bpToPx({ refName, coord: coord - 1 })
  const e = model.bpToPx({ refName, coord })

  if (s && e) {
    const width = Math.max(Math.abs(e.offsetPx - s.offsetPx), 4)
    const left = Math.min(s.offsetPx, e.offsetPx) - offsetPx
    return <div className={classes.highlight} style={{ left, width }} />
  }

  return null
})

export default GenomeMouseoverHighlight
