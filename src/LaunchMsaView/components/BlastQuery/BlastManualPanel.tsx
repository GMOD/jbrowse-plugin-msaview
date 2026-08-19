import React, { useState } from 'react'

import { shorten2 } from '@jbrowse/core/util'
import { Alert, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { BASE_BLAST_URL } from './consts'
import ExternalLink from '../../../components/ExternalLink'
import TextField2 from '../../../components/TextField2'
import { useQueryRowName } from '../../useQueryRowName'
import {
  cleanProteinSequence,
  getGeneDisplayName,
  getLinearGenomeView,
} from '../../util'
import LaunchPanelContent from '../LaunchPanelContent'
import { launchView } from '../ManualMSALoader/launchView'
import QueryRowSelector from '../QueryRowSelector'
import SubmitCancelActions from '../SubmitCancelActions'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  ncbiLink: {
    wordBreak: 'break-all',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
  msaInput: {
    marginBottom: 20,
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
 * browser cannot read Blast.cgi at all (see docs/blast.md).
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
}: {
  children: React.ReactNode
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const view = getLinearGenomeView(model)
  const [launchViewError, setLaunchViewError] = useState<unknown>()
  const [msaText, setMsaText] = useState('')
  const [treeText, setTreeText] = useState('')

  const transcriptSelection = useTranscriptSelection({ feature, view })
  const { proteinSequence, selectedTranscript, error } = transcriptSelection
  const queryRow = useQueryRowName(msaText, proteinSequence)

  const s2 = cleanProteinSequence(proteinSequence)
  // a link the user follows to NCBI's own site, not something we fetch — which
  // is exactly why this route still works when the automatic one cannot
  const link = `${BASE_BLAST_URL}?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${s2}`
  const link2 = `${BASE_BLAST_URL}?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${shorten2(s2, 10)}`

  return (
    <>
      <LaunchPanelContent error={launchViewError ?? error}>
        {children}

        <TranscriptSelector feature={feature} {...transcriptSelection} />

        <div className={classes.step}>
          <Typography variant="subtitle2">1. Run the search at NCBI</Typography>
          <div className={classes.stepBody}>
            {proteinSequence ? (
              <div className={classes.ncbiLink}>
                <ExternalLink href={link}>{link2}</ExternalLink>
              </div>
            ) : (
              <Alert severity="info">
                Pick a transcript above to get a link carrying its protein
                sequence.
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
            <TextField2
              variant="outlined"
              label="Alignment"
              multiline
              minRows={5}
              maxRows={10}
              fullWidth
              className={classes.msaInput}
              slotProps={{ input: { className: classes.textAreaFont } }}
              placeholder="Paste the .aln contents here"
              value={msaText}
              onChange={event => {
                setMsaText(event.target.value)
              }}
            />
            <TextField2
              variant="outlined"
              label="Tree (optional)"
              multiline
              minRows={3}
              maxRows={10}
              fullWidth
              slotProps={{ input: { className: classes.textAreaFont } }}
              placeholder="Paste the .nh Newick tree here"
              value={treeText}
              onChange={event => {
                setTreeText(event.target.value)
              }}
            />

            <QueryRowSelector {...queryRow} />
          </div>
        </div>
      </LaunchPanelContent>

      <SubmitCancelActions
        submitDisabled={!selectedTranscript || !msaText.trim()}
        onSubmit={() => {
          try {
            if (selectedTranscript) {
              setLaunchViewError(undefined)
              launchView({
                newViewTitle: getGeneDisplayName(selectedTranscript),
                view,
                feature: selectedTranscript,
                querySeqName: queryRow.querySeqName,
                data: { msa: msaText, tree: treeText },
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

export default BlastManualPanel
