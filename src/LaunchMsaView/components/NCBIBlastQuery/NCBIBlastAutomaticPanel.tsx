import React, { useEffect, useState } from 'react'

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

import { blastLaunchView } from './blastLaunchView'
import TextField2 from '../../../TextField2'
import {
  getGeneDisplayName,
  getId,
  getTranscriptDisplayName,
  getTranscriptFeatures,
} from '../../util'
import TranscriptSelector from '../TranscriptSelector'
import { useFeatureSequence } from '../useFeatureSequence'

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
  const [launchViewError, setLaunchViewError] = useState<unknown>()
  const [selectedBlastDatabase, setSelectedBlastDatabase] = useState('nr')
  const [selectedMsaAlgorithm, setSelectedMsaAlgorithm] = useState('clustalo')
  const options = getTranscriptFeatures(feature)
  const [selectedTranscriptId, setSelectedTranscriptId] = useState(
    getId(options[0]),
  )
  const [selectedBlastProgram, setSelectedBlastProgram] = useState('blastp')
  const selectedTranscript = options.find(
    val => getId(val) === selectedTranscriptId,
  )!
  const { error, proteinSequence } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })

  const blastDatabaseOptions = ['nr', 'nr_cluster_seq']
  const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft']
  const blastPrograms =
    selectedBlastDatabase === 'nr_cluster_seq'
      ? ['blastp']
      : ['blastp', 'quick-blastp']
  useEffect(() => {
    if (selectedBlastDatabase === 'nr_cluster_seq') {
      setSelectedTranscriptId('blastp')
    }
  }, [selectedBlastDatabase])
  const e = error ?? launchViewError
  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {children}
        {e ? <ErrorMessage error={e} /> : null}
        <TextField2
          variant="outlined"
          label="BLAST database"
          style={{ width: 150 }}
          select
          value={selectedBlastDatabase}
          onChange={event => {
            setSelectedBlastDatabase(event.target.value)
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
          style={{ width: 150 }}
          select
          value={selectedMsaAlgorithm}
          onChange={event => {
            setSelectedMsaAlgorithm(event.target.value)
          }}
        >
          {msaAlgorithms.map(val => (
            <MenuItem value={val} key={val}>
              {val}
            </MenuItem>
          ))}
        </TextField2>

        <TextField2
          variant="outlined"
          label="BLAST program"
          style={{ width: 150 }}
          select
          value={selectedBlastProgram}
          onChange={event => {
            setSelectedBlastProgram(event.target.value)
          }}
        >
          {blastPrograms.map(val => (
            <MenuItem value={val} key={val}>
              {val}
            </MenuItem>
          ))}
        </TextField2>

        <TranscriptSelector
          feature={feature}
          options={options}
          selectedTranscriptId={selectedTranscriptId}
          onTranscriptChange={setSelectedTranscriptId}
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
            try {
              setLaunchViewError(undefined)
              blastLaunchView({
                feature: selectedTranscript,
                view,
                newViewTitle: `BLAST - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)}`,
                blastParams: {
                  blastProgram: selectedBlastProgram,
                  blastDatabase: selectedBlastDatabase,
                  msaAlgorithm: selectedMsaAlgorithm,
                  selectedTranscript,
                  proteinSequence,
                },
              })
            } catch (e) {
              console.error(e)
              setLaunchViewError(e)
            }

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
