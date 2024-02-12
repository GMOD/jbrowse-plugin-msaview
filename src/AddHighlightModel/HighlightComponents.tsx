import React from 'react'
import { observer } from 'mobx-react'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import MsaToGenomeHighlight from './MsaToGenomeHighlight'
import GenomeMouseoverHighlight from './GenomeMouseoverHighlight'

type LGV = LinearGenomeViewModel

const HighlightComponents = observer(function Highlight({
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
