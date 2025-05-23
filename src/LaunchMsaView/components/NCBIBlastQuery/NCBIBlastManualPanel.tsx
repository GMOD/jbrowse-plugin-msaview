import React, { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { getContainingView, shorten2 } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { getProteinSequenceFromFeature } from './calculateProteinSequence'
import { useFeatureSequence } from './useFeatureSequence'
import TextField2 from '../../../TextField2'
import {
  getGeneDisplayName,
  getId,
  getTranscriptDisplayName,
  getTranscriptFeatures,
} from '../../util'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

const NCBIBlastManualPanel = observer(function ({
  handleClose,
  feature,
  model,
  children,
}: {
  children: React.ReactNode
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearGenomeViewModel
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

  const link = `https://blast.ncbi.nlm.nih.gov/Blast.cgi?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${proteinSequence}`
  const link2 = `https://blast.ncbi.nlm.nih.gov/Blast.cgi?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${shorten2(proteinSequence, 10)}`
  const [showSequence, setShowSequence] = useState(false)

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {children}
        {error ? <ErrorMessage error={error} /> : null}

        <div style={{ display: 'flex' }}>
          <TextField2
            variant="outlined"
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
          <div style={{ alignContent: 'center', marginLeft: 20 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                setShowSequence(!showSequence)
              }}
            >
              {showSequence ? 'Hide sequence' : 'Show sequence'}
            </Button>
          </div>
        </div>

        {showSequence && (
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
        )}

        {proteinSequence ? (
          <div style={{ wordBreak: 'break-all', margin: 30, maxWidth: 600 }}>
            Link to NCBI BLAST:{' '}
            <a target="_blank" href={link} rel="noreferrer">
              {link2}
            </a>
          </div>
        ) : null}

        <Typography style={{ marginTop: 20 }}>
          Click the link above and run your BLAST query, and once you have
          results, click "Multiple Alignment" at the top of the results page to
          be redirected to COBALT, NCBI's multiple sequence aligner. Once COBALT
          completes, you can download an MSA (.aln file) and optionally a Newick
          tree (.nh) and paste the results into JBrowse
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            handleClose()
          }}
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
          Close
        </Button>
      </DialogActions>
    </>
  )
})

export default NCBIBlastManualPanel
