import React from 'react'

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
  return (
    <>
      <MsaToGenomeHighlight model={model} />
      <GenomeMouseoverHighlight model={model} />
    </>
  )
})

export default HighlightComponents
