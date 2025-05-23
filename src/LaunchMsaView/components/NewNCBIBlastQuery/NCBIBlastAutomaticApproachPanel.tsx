import React, { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  getContainingView,
} from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent, MenuItem } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { ncbiBlastLaunchView } from './blastLaunchView'
import { getProteinSequenceFromFeature } from './calculateProteinSequence'
import { useFeatureSequence } from './useFeatureSequence'
import TextField2 from '../../../TextField2'
import {
  getGeneDisplayName,
  getId,
  getTranscriptDisplayName,
  getTranscriptFeatures,
} from '../../util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

const NCBIBlastPanel = observer(function ({
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
      ? getProteinSequenceFromFeature({
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
        onChange={event => {
          setBlastDatabase(event.target.value)
        }}
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
        onChange={event => {
          setMsaAlgorithm(event.target.value)
        }}
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
        onChange={event => {
          setUserSelection(event.target.value)
        }}
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
          proteinSequence
            ? `>${getTranscriptDisplayName(selectedTranscript)}\n${proteinSequence}`
            : 'Loading...'
        }
        slotProps={{
          input: {
            readOnly: true,
            classes: {
              input: classes.textAreaFont,
            },
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
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </DialogContent>
  )
})

export default NCBIBlastPanel
