import React, { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  getContainingView,
} from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { ncbiBlastLaunchView } from './blastLaunchView'
import { useFeatureSequence } from '../useFeatureSequence'
import TextField2 from '../../../TextField2'
import TranscriptSelector from '../TranscriptSelector'
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

const NCBIBlastAutomaticPanel = observer(function ({
  handleClose,
  feature,
  model,
  children,
}: {
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearGenomeViewModel
  const [blastDatabase, setBlastDatabase] = useState('nr')
  const [msaAlgorithm, setMsaAlgorithm] = useState('clustalo')

  const options = getTranscriptFeatures(feature)
  const [userSelection, setUserSelection] = useState(getId(options[0]))
  const selectedTranscript = options.find(val => getId(val) === userSelection)!
  const { error, proteinSequence } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })

  const blastDatabaseOptions = ['nr', 'nr_cluster_seq']
  const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft']
  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {children}
        {error ? <ErrorMessage error={error} /> : null}
        <TextField2
          variant="outlined"
          label="BLAST database"
          style={{ width: 100 }}
          select
          value={blastDatabase}
          onChange={event => {
            setBlastDatabase(event.target.value)
          }}
        >
          {blastDatabaseOptions.map(val => (
            <MenuItem value={val} key={val}>
              {val}
            </MenuItem>
          ))}
        </TextField2>

        <TextField2
          variant="outlined"
          label="MSA Algorithm"
          style={{ width: 100 }}
          select
          value={msaAlgorithm}
          onChange={event => {
            setMsaAlgorithm(event.target.value)
          }}
        >
          {msaAlgorithms.map(val => (
            <MenuItem value={val} key={val}>
              {val}
            </MenuItem>
          ))}
        </TextField2>

        <TranscriptSelector
          feature={feature}
          options={options}
          selectedTranscriptId={userSelection}
          onTranscriptChange={setUserSelection}
          proteinSequence={proteinSequence}
        />

        <Typography style={{ marginTop: 20 }}>
          This panel will automatically submit a query to NCBI using blastp. The
          process can 10+ minutes to run. After completion, all the hits will be
          run through a multiple sequence alignment. Note: we are not able to
          currently run NCBI COBALT automatically on the BLAST results, even
          though that is the method NCBI uses on their website. If you need a
          COBALT alignment, please use the manual approach of submitting BLAST
          yourself and downloading the resulting files
        </Typography>
      </DialogContent>
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
    </>
  )
})

export default NCBIBlastAutomaticPanel
