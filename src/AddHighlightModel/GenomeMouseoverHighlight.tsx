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
  const { hovered } = getSession(model)
  return hovered &&
    typeof hovered === 'object' &&
    'hoverPosition' in hovered ? (
    <GenomeMouseoverHighlightPostNullCheck model={model} />
  ) : null
})

const GenomeMouseoverHighlightPostNullCheck = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  if (session.views.some(s => s.type === 'MsaView')) {
    const { hovered } = session
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
  }
  return null
})

export default GenomeMouseoverHighlight
