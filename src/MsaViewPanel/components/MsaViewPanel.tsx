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
  // three gate the same panel -- see LaunchProgress. An indexed view keeps its
  // init for the life of the view (it is how the block is refetched), so that
  // one is only "launching" until the alignment arrives.
  const pending = !!(
    blastParams ??
    orthologParams ??
    (init && !model.dataInitialized)
  )
  // a view whose stored alignment expired has no pending request and no data,
  // and its error is the only thing left to draw. LaunchProgress draws it with
  // the Retry that runs `lastLaunch` again.
  const expired = !!model.error && !!model.lastLaunch && !model.dataInitialized
  const launching = pending || expired
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
