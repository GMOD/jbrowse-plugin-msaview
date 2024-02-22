import React, { useEffect, useState } from 'react'
import { JBrowsePluginMsaViewModel } from '../model'
import { observer } from 'mobx-react'
import { Typography } from '@mui/material'
import { ErrorMessage } from '@jbrowse/core/ui'
import { getContainingView, getSession } from '@jbrowse/core/util'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import RIDLink from './RIDLink'
import {
  getGeneDisplayName,
  getTranscriptDisplayName,
} from '../../LaunchMsaView/util'

const JBrowsePluginMsaViewPanel = observer(function ({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { blastParams } = model
  const { database, msaAlgorithm, proteinSequence, selectedTranscript } =
    blastParams
  const session = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const [error, setError] = useState<unknown>()
  const [rid, setRid] = useState<string>()
  const [progress, setProgress] = useState('')
  const [processing, setProcessing] = useState(false)
  const program = 'blastp'

  const e = error || error2
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        model.setBlastParams({
          database,
          program,
          msaAlgorithm,
          selectedTranscript,
          protein,
        })
      } catch (e) {
        console.error(e)
        setProcessing(false)
        setError(e)
      }
    })()
  }, [])
  return (
    <div>
      {e ? (
        <div>
          {rid ? <RIDLink rid={rid} /> : null}
          <ErrorMessage error={e} />
        </div>
      ) : rid ? (
        <Typography>
          {rid ? (
            <>
              <RIDLink rid={rid} />.{' '}
            </>
          ) : null}
          {progress}
        </Typography>
      ) : null}
      <Typography>{processing}</Typography>
    </div>
  )
})

export default JBrowsePluginMsaViewPanel
