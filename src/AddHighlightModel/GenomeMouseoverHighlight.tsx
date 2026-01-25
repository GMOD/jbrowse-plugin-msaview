import React from 'react'

import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { useStyles } from './util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const GenomeMouseoverHighlight = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const session = getSession(model)
  const { hovered, views } = session

  // Early return if no MSA view exists
  const hasMsaView = views.some(s => s.type === 'MsaView')
  if (!hasMsaView) {
    return null
  }

  // Early return if no hover position
  if (
    !hovered ||
    typeof hovered !== 'object' ||
    !('hoverPosition' in hovered)
  ) {
    return null
  }

  return <GenomeMouseoverHighlightRenderer model={model} hovered={hovered} />
})

const GenomeMouseoverHighlightRenderer = observer(function ({
  model,
  hovered,
}: {
  model: LinearGenomeViewModel

  hovered: any
}) {
  const { classes } = useStyles()
  const { offsetPx } = model
  const { coord, refName } = hovered.hoverPosition as {
    coord: number
    refName: string
  }

  const s = model.bpToPx({ refName, coord: coord - 1 })
  const e = model.bpToPx({ refName, coord: coord })

  if (s && e) {
    const width = Math.max(Math.abs(e.offsetPx - s.offsetPx), 4)
    const left = Math.min(s.offsetPx, e.offsetPx) - offsetPx
    return <div className={classes.highlight} style={{ left, width }} />
  }

  return null
})

export default GenomeMouseoverHighlight
