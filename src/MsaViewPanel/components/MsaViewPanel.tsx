import React from 'react'

import { observer } from 'mobx-react'
import { MSAView } from 'react-msaview'

import { JBrowsePluginMsaViewModel } from '../model'
import LoadingBLAST from './LoadingBLAST'

const MsaViewPanel = observer(function MsaViewPanel2({
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

export default MsaViewPanel
