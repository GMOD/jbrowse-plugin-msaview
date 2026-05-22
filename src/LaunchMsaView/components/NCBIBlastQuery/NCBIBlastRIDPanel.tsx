import React, { useState } from 'react'

import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import MsaAlgorithmSelect from './MsaAlgorithmSelect'
import { blastLaunchView } from './blastLaunchView'
import ExternalLink from '../../../components/ExternalLink'
import TextField2 from '../../../components/TextField2'
import { getBlastViewTitle, getLinearGenomeView } from '../../util'
import LaunchPanelContent from '../LaunchPanelContent'
import SubmitCancelActions from '../SubmitCancelActions'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type { MsaAlgorithm } from './consts'
import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  marginBottom: {
    marginBottom: 16,
  },
  ridField: {
    width: 150,
  },
  infoText: {
    marginTop: 20,
  },
})

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
  const view = getLinearGenomeView(model)
  const [launchViewError, setLaunchViewError] = useState<unknown>()
  const [rid, setRid] = useState('')
  const [selectedMsaAlgorithm, setSelectedMsaAlgorithm] =
    useState<MsaAlgorithm>('clustalo')

  const transcriptSelection = useTranscriptSelection({ feature, view })
  const { selectedTranscript, proteinSequence } = transcriptSelection

  const e = transcriptSelection.error ?? launchViewError
  const trimmedRid = rid.trim()

  return (
    <>
      <LaunchPanelContent error={e}>
        {children}

        <Typography variant="body2" className={classes.marginBottom}>
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
          className={classes.marginBottom}
          value={rid}
          onChange={event => {
            setRid(event.target.value)
          }}
        />

        {trimmedRid ? (
          <Typography variant="body2" className={classes.marginBottom}>
            <ExternalLink href={`${baseUrl}?CMD=Get&RID=${trimmedRid}`}>
              View BLAST results on NCBI
            </ExternalLink>
          </Typography>
        ) : null}

        <MsaAlgorithmSelect
          className={classes.ridField}
          value={selectedMsaAlgorithm}
          onChange={setSelectedMsaAlgorithm}
        />

        <TranscriptSelector feature={feature} {...transcriptSelection} />

        <Typography className={classes.infoText}>
          This will fetch the BLAST results for the provided RID and run them
          through a multiple sequence alignment. The protein sequence from the
          selected transcript will be added as the query sequence in the MSA.
        </Typography>
      </LaunchPanelContent>
      <SubmitCancelActions
        submitDisabled={!proteinSequence || !trimmedRid}
        onSubmit={() => {
          try {
            if (selectedTranscript && trimmedRid) {
              setLaunchViewError(undefined)
              blastLaunchView({
                feature: selectedTranscript,
                view,
                newViewTitle: getBlastViewTitle(feature, selectedTranscript),
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
              handleClose()
            }
          } catch (e) {
            console.error(e)
            setLaunchViewError(e)
          }
        }}
        onCancel={handleClose}
      />
    </>
  )
})

export default NCBIBlastRIDPanel
