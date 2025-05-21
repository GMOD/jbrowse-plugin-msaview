import React, { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { getContainingView, shorten } from '@jbrowse/core/util'
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
import { ncbiBlastLaunchView } from './ncbiBlastLaunchView'
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
  const options = getTranscriptFeatures(feature)
  const [userSelection, setUserSelection] = useState(getId(options[0]))
  const [treeResult, setTreeResult] = useState('')
  const [msaResult, setMsaResult] = useState('')
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
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
  const link2 = `https://blast.ncbi.nlm.nih.gov/Blast.cgi?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${shorten(proteinSequence)}`
  const [blastMethod, setBlastMethod] = useState('direct')

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

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Typography style={{ maxWidth: 600 }}>
            Follow the link below to NCBI BLAST, and run a multiple sequence
            alignment on the results using, for example, NCBI COBALT tool. Then
            you can import the results back into here.
          </Typography>
          <IconButton
            onClick={() => {
              setHelpDialogOpen(true)
            }}
            title="Help"
          >
            <HelpIcon />
          </IconButton>
        </div>
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

        <FormControl component="fieldset">
          <RadioGroup
            aria-label="blast-method"
            name="blast-method"
            value={blastMethod}
            onChange={event => {
              setBlastMethod(event.target.value)
            }}
          >
            <FormControlLabel
              value="direct"
              control={<Radio />}
              label="Proceed to NCBI BLAST directly"
            />
            <FormControlLabel
              value="manual"
              control={<Radio />}
              label="Manually copy and paste sequence"
            />
          </RadioGroup>
        </FormControl>

        {blastMethod === 'direct' && proteinSequence ? (
          <div>
            <Typography variant="subtitle1">Direct BLAST link:</Typography>
            <a target="_blank" href={link} rel="noreferrer">
              Proceed to NCBI BLAST:
              {link2}
            </a>
          </div>
        ) : null}

        {blastMethod === 'manual' && (
          <div>
            <Typography variant="subtitle1">
              Copy and paste the sequence below into the NCBI BLAST webpage:
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

        <TextField2
          value={msaResult}
          onChange={event => {
            setMsaResult(event.target.value)
          }}
          placeholder="Paste resulting MSA here in multi-fasta or clustal formats"
        />

        <TextField2
          value={treeResult}
          onChange={event => {
            setTreeResult(event.target.value)
          }}
          placeholder="(Optionally) Paste a newick tree here"
        />
      </DialogContent>

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            ncbiBlastLaunchView({
              feature: selectedTranscript,
              view,
              newViewTitle: `${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)}`,
              data: { msa: msaResult, tree: treeResult },
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
          Close
        </Button>
      </DialogActions>
    </>
  )
})

export default NcbiBlastPanel
