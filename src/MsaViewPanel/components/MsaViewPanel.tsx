import React from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { MSAView } from 'react-msaview'
import { makeStyles } from 'tss-react/mui'

import { ErrorBoundary } from './ErrorBoundary'
import LaunchProgress from './LaunchProgress'

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
  const { blastParams, orthologParams, init, loadingStoredData } = model
  // an unresolved launch request means there is no alignment to draw yet, so all
  // three gate the same panel -- see LaunchProgress
  const launching = !!(blastParams ?? orthologParams ?? init)
  return (
    <ErrorBoundary>
      <div>
        {launching ? (
          <LaunchProgress model={model} />
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
