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

function RIDError({
  baseUrl,
  rid,
  error,
}: {
  baseUrl: string
  rid?: string
  error: unknown
}) {
  return (
    <div>
      {rid ? <RIDLink rid={rid} baseUrl={baseUrl} /> : null}
      <ErrorMessage error={error} />
    </div>
  )
}

function RIDProgress({
  baseUrl,
  rid,
  progress,
}: {
  baseUrl: string
  rid: string
  progress: string
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.loading}>
      {rid ? <RIDLink baseUrl={baseUrl} rid={rid} /> : null}
      <Typography>{progress}</Typography>
    </div>
  )
}

const LoadingBLAST = observer(function LoadingBLAST2({
  model,
  baseUrl,
}: {
  model: JBrowsePluginMsaViewModel
  baseUrl: string
}) {
  const { progress, rid, error, processing } = model
  const { classes } = useStyles()
  return (
    <div className={classes.margin}>
      <LoadingEllipses message="Running NCBI BLAST" variant="h5" />
      {error ? (
        <RIDError baseUrl={baseUrl} rid={rid} error={error} />
      ) : rid ? (
        <RIDProgress baseUrl={baseUrl} rid={rid} progress={progress} />
      ) : null}
      <Typography>{processing || 'Initializing BLAST query'}</Typography>
    </div>
  )
})

export default LoadingBLAST
