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

import { blastLaunchView } from './blastLaunchView'
import ExternalLink from '../../../components/ExternalLink'
import TextField2 from '../../../components/TextField2'
import { getGeneDisplayName, getTranscriptDisplayName } from '../../util'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft'] as const

type msaAlgorithmsT = (typeof msaAlgorithms)[number]

const NCBIBlastRIDPanel = observer(function ({
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
  const [rid, setRid] = useState('')
  const [selectedMsaAlgorithm, setSelectedMsaAlgorithm] =
    useState<msaAlgorithmsT>('clustalo')

  const {
    options,
    selectedId,
    setSelectedId,
    selectedTranscript,
    proteinSequence,
    error: proteinSequenceError,
  } = useTranscriptSelection({ feature, view })

  const e = proteinSequenceError ?? launchViewError
  const style = { width: 150 }
  const trimmedRid = rid.trim()

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {children}
        {e ? <ErrorMessage error={e} /> : null}

        <Typography variant="body2" style={{ marginBottom: 16 }}>
          Enter the RID (Request ID) from a previously submitted NCBI BLAST
          query. You can find the RID in the BLAST results page URL or at the
          top of the results page. RIDs are typically valid for 24-36 hours
          after submission.
        </Typography>

        <TextField2
          variant="outlined"
          label="BLAST RID"
          placeholder="e.g., ABC12345"
          fullWidth
          style={{ marginBottom: 16 }}
          value={rid}
          onChange={event => {
            setRid(event.target.value)
          }}
        />

        {trimmedRid ? (
          <Typography variant="body2" style={{ marginBottom: 16 }}>
            <ExternalLink href={`${baseUrl}?CMD=Get&RID=${trimmedRid}`}>
              View BLAST results on NCBI
            </ExternalLink>
          </Typography>
        ) : null}

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

        <TranscriptSelector
          feature={feature}
          options={options}
          selectedId={selectedId}
          selectedTranscript={selectedTranscript}
          onTranscriptChange={setSelectedId}
          proteinSequence={proteinSequence}
        />

        <Typography style={{ marginTop: 20 }}>
          This will fetch the BLAST results for the provided RID and run them
          through a multiple sequence alignment. The protein sequence from the
          selected transcript will be added as the query sequence in the MSA.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            try {
              if (!selectedTranscript || !trimmedRid) {
                return
              }
              setLaunchViewError(undefined)
              blastLaunchView({
                feature: selectedTranscript,
                view,
                newViewTitle: `BLAST - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)}`,
                blastParams: {
                  baseUrl,
                  blastProgram: 'blastp',
                  blastDatabase: 'nr',
                  msaAlgorithm: selectedMsaAlgorithm,
                  selectedTranscript,
                  proteinSequence,
                  rid: trimmedRid,
                },
              })
            } catch (e) {
              console.error(e)
              setLaunchViewError(e)
            }

            handleClose()
          }}
          disabled={!proteinSequence || !trimmedRid}
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

export default NCBIBlastRIDPanel
