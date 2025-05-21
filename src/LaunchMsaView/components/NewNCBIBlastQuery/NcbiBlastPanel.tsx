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

import { getProteinSequenceFromFeature } from './calculateProteinSequence'
import { ncbiBlastLaunchView } from './ncbiBlastLaunchView'
import { useFeatureSequence } from './useFeatureSequence'
import BlastOptions from './BlastOptions'
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
  const [geneTreeId, setGeneTreeId] = useState('')

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
  const seq = proteinSequence ? proteinSequence : 'Loading...'
  return (
    <DialogContent className={classes.dialogContent}>
      {error ? <ErrorMessage error={error} /> : null}

      <TextField2
        label="Choose isoform to BLAST"
        select
        value={userSelection}
        onChange={event => {
          setUserSelection(event.target.value)
        }}
      >
        {options.map(val => (
          <MenuItem value={getId(val)} key={val.id()}>
            {getGeneDisplayName(feature)} - {getTranscriptDisplayName(val)}
          </MenuItem>
        ))}
      </TextField2>
      {proteinSequence ? (
        <a
          target="_blank"
          href={`https://blast.ncbi.nlm.nih.gov/Blast.cgi?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${proteinSequence}`}
        >
          Link to NCBI BLAST
        </a>
      ) : null}
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
            ncbiBlastLaunchView({
              feature: selectedTranscript,
              view,
              newViewTitle: `NCBI BLAST - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)} - ${msaAlgorithm}`,
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

export default NcbiBlastPanel
