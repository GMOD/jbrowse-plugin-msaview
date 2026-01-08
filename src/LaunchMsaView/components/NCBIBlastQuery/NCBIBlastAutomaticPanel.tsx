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
import TextField2 from '../../../components/TextField2'
import {
  getGeneDisplayName,
  getId,
  getLongestTranscript,
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

const blastDatabaseOptions = ['nr', 'nr_cluster_seq'] as const
const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft'] as const
const blastPrograms = ['blastp', 'quick-blastp'] as const

type blastDatabaseOptionsT = (typeof blastDatabaseOptions)[number]
type msaAlgorithmsT = (typeof msaAlgorithms)[number]
type blastProgramsT = (typeof blastPrograms)[number]

const NCBIBlastAutomaticPanel = observer(function ({
  handleClose,
  feature,
  model,
  children,
  baseUrl,
}: {
  model: AbstractTrackModel
  feature: Feature
  baseUrl: string
  handleClose: () => void
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearGenomeViewModel
  const [launchViewError, setLaunchViewError] = useState<unknown>()
  const [selectedBlastDatabase, setSelectedBlastDatabase] =
    useState<blastDatabaseOptionsT>('nr')
  const [selectedMsaAlgorithm, setSelectedMsaAlgorithm] =
    useState<msaAlgorithmsT>('clustalo')
  const options = getTranscriptFeatures(feature)
  const [selectedTranscriptId, setSelectedTranscriptId] = useState(
    getId(getLongestTranscript(options)),
  )
  const [selectedBlastProgram, setSelectedBlastProgram] =
    useState<blastProgramsT>('quick-blastp')
  const selectedTranscript = options.find(
    val => getId(val) === selectedTranscriptId,
  )!
  const { error: proteinSequenceError, proteinSequence } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })

  useEffect(() => {
    if (selectedBlastDatabase === 'nr_cluster_seq') {
      setSelectedBlastProgram('blastp')
    }
  }, [selectedBlastDatabase])
  const e = proteinSequenceError ?? launchViewError
  const style = { width: 150 }
  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {children}
        {e ? <ErrorMessage error={e} /> : null}
        <TextField2
          variant="outlined"
          label="BLAST database"
          style={style}
          select
          value={selectedBlastDatabase}
          onChange={event => {
            setSelectedBlastDatabase(
              event.target.value as (typeof blastDatabaseOptions)[number],
            )
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
          style={style}
          select
          value={selectedMsaAlgorithm}
          onChange={event => {
            setSelectedMsaAlgorithm(
              event.target.value as (typeof msaAlgorithms)[number],
            )
          }}
        >
          {msaAlgorithms.map(val => (
            <MenuItem value={val} key={val}>
              {val}
            </MenuItem>
          ))}
        </TextField2>

        <div style={{ display: 'flex' }}>
          <TextField2
            variant="outlined"
            label="BLAST program"
            disabled={selectedBlastDatabase === 'nr_cluster_seq'}
            style={style}
            select
            value={selectedBlastProgram}
            onChange={event => {
              setSelectedBlastProgram(
                event.target.value as (typeof blastPrograms)[number],
              )
            }}
          >
            {blastPrograms.map(val => (
              <MenuItem value={val} key={val}>
                {val}
              </MenuItem>
            ))}
          </TextField2>
          {selectedBlastDatabase === 'nr_cluster_seq' ? (
            <Typography
              variant="subtitle2"
              style={{
                marginLeft: 4,
                alignContent: 'center',
              }}
            >
              Can only use blastp on nr_cluster_seq
            </Typography>
          ) : null}
        </div>

        <TranscriptSelector
          feature={feature}
          options={options}
          selectedTranscriptId={selectedTranscriptId}
          onTranscriptChange={setSelectedTranscriptId}
          proteinSequence={proteinSequence}
        />

        <Typography style={{ marginTop: 20 }}>
          This panel will automatically submit a query to NCBI. Using blastp can
          take 10+ minutes to run, quick-blastp is generally a lot faster but is
          not available for the clustered database. After completion, all the
          hits will be run through a multiple sequence alignment. Note: we are
          not able to currently run NCBI COBALT automatically on the BLAST
          results, even though that is the method NCBI uses on their website. If
          you need a COBALT alignment, please use the manual approach of
          submitting BLAST yourself and downloading the resulting files
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
                  baseUrl,
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
