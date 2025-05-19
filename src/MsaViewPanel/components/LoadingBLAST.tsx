import React from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { JBrowsePluginMsaViewModel } from '../model'
import RIDLink from './RIDLink'

const useStyles = makeStyles()(theme => ({
  margin: {
    padding: 20,
  },
  loading: {
    background: theme.palette.background.paper,
  },
}))

function RIDError({ rid, error }: { rid?: string; error: unknown }) {
  return (
    <div>
      {rid ? <RIDLink rid={rid} /> : null}
      <ErrorMessage error={error} />
    </div>
  )
}

function RIDProgress({ rid, progress }: { rid: string; progress: string }) {
  const { classes } = useStyles()
  return (
    <div className={classes.loading}>
      {rid ? <RIDLink rid={rid} /> : null}
      <Typography>{progress}</Typography>
    </div>
  )
}

const LoadingBLAST = observer(function LoadingBLAST2({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { progress, rid, error, processing } = model
  const { classes } = useStyles()
  return (
    <div className={classes.margin}>
      <LoadingEllipses message="Running NCBI BLAST" variant="h5" />
      {error ? (
        <RIDError rid={rid} error={error} />
      ) : (rid ? (
        <RIDProgress rid={rid} progress={progress} />
      ) : null)}
      <Typography>{processing || 'Initializing BLAST query'}</Typography>
    </div>
  )
})

export default LoadingBLAST
