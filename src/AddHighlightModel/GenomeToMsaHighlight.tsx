import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { getSession } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    background: 'rgba(255,255,0,0.2)',
    border: '1px solid rgba(50,50,0,0.2)',
    position: 'absolute',
    zIndex: 1000,
    textAlign: 'center',
    pointerEvents: 'none',
    overflow: 'hidden',
  },
})

const GenomeToMsaHighlight = observer(function ({
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

export default GenomeToMsaHighlight
