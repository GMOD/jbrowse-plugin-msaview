import React from 'react'
import { observer } from 'mobx-react'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { getSession } from '@jbrowse/core/util'
import { useStyles } from './util'

const GenomeMouseoverHighlight = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { hovered } = getSession(model)
  return hovered &&
    typeof hovered === 'object' &&
    'hoverPosition' in hovered ? (
    <HoverHighlight model={model} />
  ) : null
})

const HoverHighlight = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { hovered } = getSession(model)
  const { offsetPx } = model
  // @ts-expect-error
  const { coord, refName } = hovered.hoverPosition

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
