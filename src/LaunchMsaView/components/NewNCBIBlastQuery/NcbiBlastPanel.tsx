import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { Button, DialogActions, DialogContent, MenuItem } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import {
  AbstractTrackModel,
  Feature,
  getContainingView,
} from '@jbrowse/core/util'
import { ErrorMessage } from '@jbrowse/core/ui'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import {
  getId,
  getTranscriptDisplayName,
  getTranscriptFeatures,
  getGeneDisplayName,
} from '../../util'
import { getProteinSequence } from './calculateProteinSequence'
import { useFeatureSequence } from './useFeatureSequence'
import TextField2 from '../../../TextField2'
import { ncbiBlastLaunchView } from './ncbiBlastLaunchView'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

const NcbiBlastPanel = observer(function NcbiBlastPanel2({
  handleClose,
  feature,
  model,
}: {
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearGenomeViewModel
  const [blastDatabase, setBlastDatabase] = useState('nr')
  const [msaAlgorithm, setMsaAlgorithm] = useState('clustalo')

  const options = getTranscriptFeatures(feature)
  const [userSelection, setUserSelection] = useState(getId(options[0]))
  const selectedTranscript = options.find(val => getId(val) === userSelection)!
  const { sequence, error } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })
  const proteinSequence =
    sequence && !('error' in sequence)
      ? getProteinSequence({
          seq: sequence.seq,
          selectedTranscript,
        })
      : ''

  const blastDatabaseOptions = ['nr', 'nr_cluster_seq']
  const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft']
  return (
    <DialogContent className={classes.dialogContent}>
      {error ? <ErrorMessage error={error} /> : null}
      <TextField2
        value={blastDatabase}
        onChange={event => setBlastDatabase(event.target.value)}
        label="BLAST blastDatabase"
        select
      >
        {blastDatabaseOptions.map(val => (
          <MenuItem value={val} key={val}>
            {val}
          </MenuItem>
        ))}
      </TextField2>

      <TextField2
        value={msaAlgorithm}
        onChange={event => setMsaAlgorithm(event.target.value)}
        label="MSA Algorithm"
        select
      >
        {msaAlgorithms.map(val => (
          <MenuItem value={val} key={val}>
            {val}
          </MenuItem>
        ))}
      </TextField2>

      <TextField2
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
      </TextField2>
      <TextField2
        variant="outlined"
        multiline
        minRows={5}
        maxRows={10}
        fullWidth
        value={
          !proteinSequence
            ? 'Loading...'
            : `>${getTranscriptDisplayName(selectedTranscript)}\n${proteinSequence}`
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
            const newView = ncbiBlastLaunchView({
              feature: selectedTranscript,
              view,
              newViewTitle: `NCBI BLAST - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)} - ${msaAlgorithm}`,
            })
            newView.setBlastParams({
              blastProgram: 'blastp',
              blastDatabase,
              msaAlgorithm,
              selectedTranscript,
              proteinSequence,
            })
            handleClose()
          }}
          disabled={!proteinSequence}
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
