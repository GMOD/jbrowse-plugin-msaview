import React from 'react'
import { observer } from 'mobx-react'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import MsaToGenomeHighlight from './MsaToGenomeHighlight'
import GenomeToMsaHighlight from './GenomeToMsaHighlight'

type LGV = LinearGenomeViewModel

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  return (
    <>
      <MsaToGenomeHighlight model={model} />
      <GenomeToMsaHighlight model={model} />
    </>
  )
})

export default Highlight
