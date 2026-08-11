import React from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import RIDLink from './RIDLink'

import type { BlastService } from '../../LaunchMsaView/components/NCBIBlastQuery/consts'
import type { JBrowsePluginMsaViewModel } from '../model'

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
  blastService,
  rid,
  error,
}: {
  baseUrl: string
  blastService?: BlastService
  rid?: string
  error: unknown
}) {
  return (
    <div>
      {rid ? (
        <RIDLink rid={rid} baseUrl={baseUrl} blastService={blastService} />
      ) : null}
      <ErrorMessage error={error} />
    </div>
  )
}

function RIDProgress({
  baseUrl,
  blastService,
  rid,
  progress,
}: {
  baseUrl: string
  blastService?: BlastService
  rid: string
  progress: string
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.loading}>
      {rid ? (
        <RIDLink baseUrl={baseUrl} rid={rid} blastService={blastService} />
      ) : null}
      <Typography>{progress}</Typography>
    </div>
  )
}

const LoadingBLAST = observer(function LoadingBLAST2({
  model,
  baseUrl,
  blastService,
}: {
  model: JBrowsePluginMsaViewModel
  baseUrl: string
  blastService?: BlastService
}) {
  const { progress, rid, error } = model
  const { classes } = useStyles()
  return (
    <div className={classes.margin}>
      <LoadingEllipses
        message={`Running ${blastService === 'ebi' ? 'EBI' : 'NCBI'} BLAST`}
        variant="h5"
      />
      {error ? (
        <RIDError
          baseUrl={baseUrl}
          blastService={blastService}
          rid={rid}
          error={error}
        />
      ) : rid ? (
        <RIDProgress
          baseUrl={baseUrl}
          blastService={blastService}
          rid={rid}
          progress={progress}
        />
      ) : (
        <Typography>{progress || 'Initializing BLAST query'}</Typography>
      )}
    </div>
  )
})

export default LoadingBLAST
