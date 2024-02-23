import React from 'react'
import { observer } from 'mobx-react'
import { MSAView } from 'react-msaview'

// locals
import { JBrowsePluginMsaViewModel } from '../model'
import LoadingBLAST from './LoadingBLAST'

const JBrowsePluginMsaViewPanel = observer(function ({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { blastParams } = model
  return (
    <div>
      {blastParams ? <LoadingBLAST model={model} /> : <MSAView model={model} />}
    </div>
  )
})

export default JBrowsePluginMsaViewPanel
