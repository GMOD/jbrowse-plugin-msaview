import React from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { MSAView } from 'react-msaview'
import { makeStyles } from 'tss-react/mui'

import { ErrorBoundary } from './ErrorBoundary'
import LoadingBLAST from './LoadingBLAST'

import type { JBrowsePluginMsaViewModel } from '../model'

const useStyles = makeStyles()({
  loadingContainer: {
    padding: 20,
  },
})

const MsaViewPanel = observer(function MsaViewPanel2({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { classes } = useStyles()
  const { blastParams, loadingStoredData } = model
  return (
    <ErrorBoundary>
      <div>
        {blastParams ? (
          <LoadingBLAST model={model} baseUrl={blastParams.baseUrl} />
        ) : loadingStoredData ? (
          <div className={classes.loadingContainer}>
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
