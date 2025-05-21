import React, { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { getContainingView, shorten2 } from '@jbrowse/core/util'
import HelpIcon from '@mui/icons-material/Help'
import {
  Button,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import HelpDialog from './HelpDialog'
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
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
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
  handleClose: (arg: boolean) => void
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
  const [blastMethod, setBlastMethod] = useState('direct')
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)

  return helpDialogOpen ? (
    <HelpDialog
      onClose={() => {
        setHelpDialogOpen(false)
      }}
    />
  ) : (
    <>
      <DialogContent className={classes.dialogContent}>
        {error ? <ErrorMessage error={error} /> : null}

        <Typography variant="subtitle1">
          Choose isoform for gene "{getGeneDisplayName(feature)}" to retrieve
          its protein coding sequence:{' '}
          <TextField2
            select
            variant="outlined"
            value={userSelection}
            onChange={event => {
              setUserSelection(event.target.value)
            }}
          >
            {options.map(val => (
              <MenuItem value={getId(val)} key={val.id()}>
                {getTranscriptDisplayName(val)}
              </MenuItem>
            ))}
          </TextField2>
        </Typography>

        <FormControl component="fieldset">
          <RadioGroup
            value={blastMethod}
            onChange={event => { setBlastMethod(event.target.value) }}
          >
            <FormControlLabel
              value="direct"
              control={<Radio />}
              label="Launch NCBI BLAST for this sequence"
            />
            <FormControlLabel
              value="manual"
              control={<Radio />}
              label="Manually copy and paste sequence"
            />
          </RadioGroup>
        </FormControl>

        {blastMethod === 'direct' && proteinSequence ? (
          <div style={{ wordBreak: 'break-all' }}>
            Link to NCBI BLAST:{' '}
            <a target="_blank" href={link} rel="noreferrer">
              {link2}
            </a>
          </div>
        ) : null}

        {blastMethod === 'manual' && (
          <div>
            <Typography variant="subtitle1">
              Copy and paste the sequence below into the NCBI BLAST or similar
              application:
            </Typography>
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
          </div>
        )}
        <Typography>
          After you have run NCBI BLAST, you can download .aln and/or newick
          tree .nh file, and manually open them in the "Open MSA" tab{' '}
          <IconButton
            onClick={() => {
              setHelpDialogOpen(true)
            }}
          >
            <HelpIcon />
          </IconButton>
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            handleClose(true)
          }}
        >
          Proceed to the "Open MSA" tab
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            handleClose(false)
          }}
        >
          Close
        </Button>
      </DialogActions>
    </>
  )
})

export default NCBIBlastPanel
