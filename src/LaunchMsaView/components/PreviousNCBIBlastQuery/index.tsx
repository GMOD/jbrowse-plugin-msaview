import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
  TextFieldProps,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { ErrorMessage } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  SimpleFeature,
  SimpleFeatureSerialized,
  getContainingView,
  getSession,
  useLocalStorage,
} from '@jbrowse/core/util'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { ncbiBlastLaunchView } from './ncbiBlastLaunchView'
import { getTranscriptDisplayName, getGeneDisplayName } from '../../util'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

function TextField2({ children, ...rest }: TextFieldProps) {
  return (
    <div>
      <TextField {...rest}>{children}</TextField>
    </div>
  )
}

interface PreviousBLASTQueries {
  rid: string
  transcript: SimpleFeatureSerialized
  data: {
    tree: string
    msa: string
  }
}

const NcbiBlastPanel = observer(function ({
  handleClose,
  feature,
  model,
}: {
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const [error, setError] = useState<unknown>()
  const [previousQueries] = useLocalStorage(
    'previous-blast-queries',
    [] as PreviousBLASTQueries[],
  )
  const [selectedPreviousQuery, setSelectedPreviousQuery] = useState(
    previousQueries[0]?.rid || '',
  )
  const map = Object.fromEntries(previousQueries.map(r => [r.rid, r]))
  const result = map[selectedPreviousQuery]

  return (
    <DialogContent className={classes.dialogContent}>
      {error ? <ErrorMessage error={error} /> : null}
      {previousQueries.length ? (
        <TextField2
          value={selectedPreviousQuery}
          onChange={event => setSelectedPreviousQuery(event.target.value)}
          label="Previous BLAST query"
          select
        >
          {previousQueries.map(val => (
            <MenuItem value={val.rid} key={val.rid}>
              {getTranscriptDisplayName(new SimpleFeature(val.transcript))} -{' '}
              {val.rid}
            </MenuItem>
          ))}
        </TextField2>
      ) : (
        <div>No previous NCBI BLAST queries found</div>
      )}

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                if (!result) {
                  throw new Error(`RID ${selectedPreviousQuery} not found`)
                }
                const { transcript, rid, data } = result
                const selectedTranscript = new SimpleFeature(transcript)
                setError(undefined)
                await ncbiBlastLaunchView({
                  session,
                  feature: selectedTranscript,
                  view,
                  newViewTitle: `NCBI BLAST - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)} - RID ${rid}`,
                  data,
                })
                handleClose()
              } catch (e) {
                console.error(e)
                setError(e)
              }
            })()
          }}
        >
          Submit
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
      </DialogActions>
    </DialogContent>
  )
})

export default NcbiBlastPanel
