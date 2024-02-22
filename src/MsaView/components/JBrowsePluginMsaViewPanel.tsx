import React from 'react'
import { observer } from 'mobx-react'
import { MSAView } from 'react-msaview'
import { JBrowsePluginMsaViewModel } from '../model'

const JBrowsePluginMsaViewPanel = observer(function ({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { loadingBLAST } = model
  return (
    <div>
      {loadingBlast ? (
        <LoadingBLAST model={model} />
      ) : (
        <MSAView model={model} />
      )}
    </div>
  )
})

export default JBrowsePluginMsaViewPanel
