import React, { useRef } from 'react'

import { observer } from 'mobx-react'

import GenomeMouseoverHighlight from './GenomeMouseoverHighlight'
import MsaToGenomeHighlight from './MsaToGenomeHighlight'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const HighlightComponents = observer(function HighlightComponents2({
  model,
}: {
  model: LGV
}) {
  const renderCount = useRef(0)
  const lastRender = useRef(performance.now())

  renderCount.current++
  const now = performance.now()
  const delta = now - lastRender.current
  lastRender.current = now

  // Log if rendering more frequently than 50ms
  if (delta < 50) {
    console.log(
      '[MSA-DEBUG] HighlightComponents render',
      `#${renderCount.current}`,
      `delta=${delta.toFixed(1)}ms`,
      `offsetPx=${model.offsetPx}`,
    )
  }

  // TEMPORARILY DISABLED GenomeMouseoverHighlight to test scroll performance
  return (
    <>
      <MsaToGenomeHighlight model={model} />
      {/* <GenomeMouseoverHighlight model={model} /> */}
    </>
  )
})

export default HighlightComponents
