import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogActions,
  DialogContent,
  Link,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { ErrorMessage } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { BLAST_URL, queryBlast } from '../blast'
import { ncbiBlastLaunchView } from '../ncbiBlastLaunchView'
import { useFeatureSequence } from './useFeatureSequence'
import {
  getTranscriptDisplayName,
  getId,
  getProteinSequence,
  getTranscriptFeatures,
  getGeneDisplayName,
} from '../util'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

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
  const [rid, setRid] = useState<string>()
  const [progress, setProgress] = useState('')
  const database = 'nr_cluster_seq'
  const program = 'blastp'

  const options = getTranscriptFeatures(feature)
  const [userSelection, setUserSelection] = useState(getId(options[0]))
  const selectedTranscript = options.find(val => getId(val) === userSelection)!
  const { sequence, error: error2 } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })
  const protein =
    sequence && !('error' in sequence)
      ? getProteinSequence({
          seq: sequence.seq,
          selectedTranscript,
        })
      : ''
  console.log({ sequence, protein, selectedTranscript })

  const e = error || error2
  return (
    <DialogContent className={classes.dialogContent}>
      {e ? <ErrorMessage error={e} /> : null}
      {rid ? (
        <Typography>
          Waiting for result.{' '}
          <Link href={`${BLAST_URL}?CMD=Get&RID=${rid}`}>RID {rid}</Link>.{' '}
          {progress}
        </Typography>
      ) : null}

      <Typography>
        Querying {database} with {program}:
      </Typography>

      <TextField
        value={userSelection}
        onChange={event => setUserSelection(event.target.value)}
        label="Choose isoform to BLAST"
        select
      >
        {options.map(val => (
          <MenuItem value={getId(val)} key={val.id()}>
            {getGeneDisplayName(feature)} - {getTranscriptDisplayName(val)}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        variant="outlined"
        multiline
        minRows={5}
        maxRows={10}
        fullWidth
        value={
          !protein
            ? 'Loading...'
            : `>${getTranscriptDisplayName(selectedTranscript)}\n${protein}`
        }
        InputProps={{
          readOnly: true,
          classes: {
            input: classes.textAreaFont,
          },
        }}
      />

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                setError(undefined)
                setRid(undefined)

                const res = await queryBlast({
                  query: protein,
                  database,
                  program,
                  onProgress: arg => setProgress(arg),
                  onRid: rid => setRid(rid),
                })
                await ncbiBlastLaunchView({
                  session,
                  feature,
                  view,
                  newViewTitle: `NCBI BLAST - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)}`,
                  data: res,
                })
                handleClose()
              } catch (e) {
                console.error(e)
                setError(e)
              }
            })()
          }}
          disabled={!protein}
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
