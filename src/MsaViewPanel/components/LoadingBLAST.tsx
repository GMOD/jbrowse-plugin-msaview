import React from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import JobLink from './JobLink'

import type { JBrowsePluginMsaViewModel } from '../model'

const useStyles = makeStyles()(theme => ({
  margin: {
    padding: 20,
  },
  loading: {
    background: theme.palette.background.paper,
  },
}))

const LoadingBLAST = observer(function LoadingBLAST2({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { progress, rid, error } = model
  const { classes } = useStyles()
  return (
    <div className={classes.margin}>
      <LoadingEllipses message="Running EBI BLAST" variant="h5" />
      {error ? (
        <div>
          {rid ? <JobLink jobId={rid} /> : null}
          <ErrorMessage error={error} />
        </div>
      ) : rid ? (
        <div className={classes.loading}>
          <JobLink jobId={rid} />
          <Typography>{progress}</Typography>
        </div>
      ) : (
        <Typography>{progress || 'Initializing BLAST query'}</Typography>
      )}
    </div>
  )
})

export default LoadingBLAST
