import React, { useState } from 'react'

import { shorten2 } from '@jbrowse/core/util'
import { Alert, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import ExternalLink from '../../../components/ExternalLink'
import { useQueryRowName } from '../../useQueryRowName'
import {
  cleanProteinSequence,
  getBlastViewTitle,
  getLinearGenomeView,
} from '../../util'
import LaunchPanelContent from '../LaunchPanelContent'
import PastedAlignmentFields from '../PastedAlignmentFields'
import QueryRowSelector from '../QueryRowSelector'
import SequenceStatusMessage from '../SequenceStatus'
import SubmitCancelActions from '../SubmitCancelActions'
import TranscriptSelector from '../TranscriptSelector'
import { launchConnectedView, useLaunchSubmit } from '../launchConnectedView'
import { useTranscriptSelection } from '../useTranscriptSelection'
import { BASE_BLAST_URL } from './consts'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  ncbiLink: {
    wordBreak: 'break-all',
  },
  step: {
    marginTop: 20,
  },
  stepBody: {
    marginLeft: 20,
    marginTop: 8,
  },
})

/**
 * The route to NCBI's `nr`, which no plugin version can query directly: NCBI
 * stopped sending Access-Control-Allow-Origin to third-party origins, so the
 * browser cannot read Blast.cgi at all (see agent-docs/blast-design.md).
 *
 * That makes the round trip through NCBI's own site the whole feature rather
 * than a fallback, so the panel walks it end to end. It used to hand the user a
 * link, tell them to "paste the results into JBrowse", and offer only a Close
 * button -- leaving them to find the Manual upload tab, re-pick the transcript
 * they had already chosen here, and hand-type the row name.
 */
const BlastManualPanel = observer(function ({
  handleClose,
  feature,
  model,
  children,
  preferredTranscriptId,
}: {
  children: React.ReactNode
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
  /** the isoform the user right-clicked, preselected in the picker */
  preferredTranscriptId?: string
}) {
  const { classes } = useStyles()
  const view = getLinearGenomeView(model)
  const { launchError, submit } = useLaunchSubmit(handleClose)
  const [msaText, setMsaText] = useState('')
  const [treeText, setTreeText] = useState('')

  const transcriptSelection = useTranscriptSelection({
    feature,
    view,
    preferredTranscriptId,
  })
  const { proteinSequence, selectedTranscript, error, sequenceStatus } =
    transcriptSelection
  const queryRow = useQueryRowName(msaText, proteinSequence)

  const s2 = cleanProteinSequence(proteinSequence)
  // a link the user follows to NCBI's own site, not something we fetch — which
  // is exactly why this route still works when the automatic one cannot
  const link = `${BASE_BLAST_URL}?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${s2}`
  const link2 = `${BASE_BLAST_URL}?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${shorten2(s2, 10)}`

  return (
    <>
      <LaunchPanelContent error={launchError ?? error}>
        {children}

        <TranscriptSelector feature={feature} {...transcriptSelection} />

        <div className={classes.step}>
          <Typography variant="subtitle2">1. Run the search at NCBI</Typography>
          <div className={classes.stepBody}>
            {proteinSequence ? (
              <div className={classes.ncbiLink}>
                <ExternalLink href={link}>{link2}</ExternalLink>
              </div>
            ) : sequenceStatus === 'loading' ? (
              <SequenceStatusMessage status={sequenceStatus} />
            ) : (
              <Alert severity="info">
                {sequenceStatus === 'error'
                  ? 'The protein sequence could not be loaded, so there is no link to follow.'
                  : 'This isoform has no coding sequence to search with. Pick another one above.'}
              </Alert>
            )}
          </div>
        </div>

        <div className={classes.step}>
          <Typography variant="subtitle2">2. Align the hits</Typography>
          <div className={classes.stepBody}>
            <Typography>
              On the results page click "Multiple Alignment" to run COBALT,
              NCBI's aligner. Download the alignment (.aln) and, if you want the
              tree drawn, the Newick tree (.nh).
            </Typography>
          </div>
        </div>

        <div className={classes.step}>
          <Typography variant="subtitle2">
            3. Paste the results back here
          </Typography>
          <div className={classes.stepBody}>
            <PastedAlignmentFields
              msaText={msaText}
              setMsaText={setMsaText}
              treeText={treeText}
              setTreeText={setTreeText}
            />

            <QueryRowSelector {...queryRow} sequenceStatus={sequenceStatus} />
          </div>
        </div>
      </LaunchPanelContent>

      <SubmitCancelActions
        model={model}
        hint={<SequenceStatusMessage status={sequenceStatus} />}
        submitDisabled={
          !selectedTranscript || sequenceStatus === 'loading' || !msaText.trim()
        }
        onSubmit={placement => {
          if (selectedTranscript) {
            submit(() =>
              launchConnectedView({
                view,
                feature: selectedTranscript,
                placement,
                displayName: getBlastViewTitle(feature, selectedTranscript),
                querySeqName: queryRow.querySeqName,
                querySeqOffset: queryRow.querySeqOffset,
                data: { msa: msaText, tree: treeText },
              }),
            )
          }
        }}
        onCancel={handleClose}
      />
    </>
  )
})

export default BlastManualPanel
