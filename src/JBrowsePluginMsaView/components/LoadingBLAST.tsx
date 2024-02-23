import React from 'react'
import { JBrowsePluginMsaViewModel } from '../model'
import { Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'

// locals
import RIDLink from './RIDLink'

const useStyles = makeStyles()({
  margin: {
    margin: 20,
  },
})

function RIDError({ rid, error }: { rid?: string; error: unknown }) {
  return (
    <div>
      {rid ? <RIDLink rid={rid} /> : null}
      <ErrorMessage error={error} />
    </div>
  )
}

function RIDProgress({ rid, progress }: { rid: string; progress: string }) {
  return (
    <Typography>
      {rid ? <RIDLink rid={rid} /> : null}
      {progress}
    </Typography>
  )
}
const LoadingBLAST = observer(function ({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { progress, rid, error, processing } = model
  const { classes } = useStyles()
  return (
    <Paper className={classes.margin}>
      <LoadingEllipses variant="h5">Running NCBI BLAST</LoadingEllipses>
      {error ? (
        <RIDError rid={rid} error={error} />
      ) : rid ? (
        <RIDProgress rid={rid} progress={progress} />
      ) : null}
      <Typography>{processing || 'Initializing BLAST query'}</Typography>
    </Paper>
  )
})

export default LoadingBLAST
