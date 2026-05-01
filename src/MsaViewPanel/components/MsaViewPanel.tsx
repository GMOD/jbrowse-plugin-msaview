import React from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { MSAView } from 'react-msaview'

import { ErrorBoundary } from './ErrorBoundary'
import LoadingBLAST from './LoadingBLAST'

import type { JBrowsePluginMsaViewModel } from '../model'

const MsaViewPanel = observer(function MsaViewPanel2({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { blastParams, loadingStoredData } = model
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  )
})

export default MsaViewPanel
