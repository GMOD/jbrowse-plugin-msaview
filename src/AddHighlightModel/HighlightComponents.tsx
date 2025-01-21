import React from 'react'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

// locals
import GenomeMouseoverHighlight from './GenomeMouseoverHighlight'
import MsaToGenomeHighlight from './MsaToGenomeHighlight'

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
