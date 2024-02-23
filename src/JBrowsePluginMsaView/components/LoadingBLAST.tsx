import React from 'react'
import { JBrowsePluginMsaViewModel } from '../model'
import { observer } from 'mobx-react'
import { Typography } from '@mui/material'
import { ErrorMessage } from '@jbrowse/core/ui'

// locals
import RIDLink from './RIDLink'

const LoadingBLAST = observer(function ({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { progress, error, rid, processing, blastParams } = model
  const { database, msaAlgorithm, proteinSequence, selectedTranscript } =
    blastParams

  return (
    <div>
      {error ? (
        <div>
          {rid ? <RIDLink rid={rid} /> : null}
          <ErrorMessage error={error} />
        </div>
      ) : rid ? (
        <Typography>
          {rid ? <RIDLink rid={rid} /> : null}
          {progress}
        </Typography>
      ) : null}
      <Typography>{processing}</Typography>
    </div>
  )
})

export default LoadingBLAST
