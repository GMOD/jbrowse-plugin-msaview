import React from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { MSAView } from 'react-msaview'

import { JBrowsePluginMsaViewModel } from '../model'
import LoadingBLAST from './LoadingBLAST'

const MsaViewPanel = observer(function MsaViewPanel2({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { blastParams, loadingStoredData } = model
  return (
    <div>
      {blastParams ? (
        <LoadingBLAST model={model} baseUrl={blastParams.baseUrl} />
      ) : loadingStoredData ? (
        <div style={{ padding: 20 }}>
          <LoadingEllipses message="Loading MSA data" variant="h6" />
        </div>
      ) : (
        <MSAView model={model} />
      )}
    </div>
  )
})

export default MsaViewPanel
