import React from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { MSAView } from 'react-msaview'
import { makeStyles } from 'tss-react/mui'

import { isLaunching } from '../isLaunching'
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
  const { loadingStoredData } = model
  const launching = isLaunching(model)
  return (
    <div>
      {launching ? (
        <LaunchProgress model={model} />
      ) : loadingStoredData && !model.dataInitialized ? (
        <div className={classes.loadingContainer}>
          <LoadingEllipses message="Loading MSA data" variant="h6" />
        </div>
      ) : (
        <MSAView model={model} />
      )}
    </div>
  )
})

export default MsaViewPanel
