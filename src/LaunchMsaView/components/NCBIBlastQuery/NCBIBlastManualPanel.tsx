import React from 'react'

import { shorten2 } from '@jbrowse/core/util'
import { Button, DialogActions, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import ExternalLink from '../../../components/ExternalLink'
import { cleanProteinSequence, getLinearGenomeView } from '../../util'
import LaunchPanelContent from '../LaunchPanelContent'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  ncbiLink: {
    wordBreak: 'break-all',
    margin: 30,
    maxWidth: 600,
  },
  infoText: {
    marginTop: 20,
  },
})

const NCBIBlastManualPanel = observer(function ({
  handleClose,
  feature,
  model,
  children,
  baseUrl,
}: {
  children: React.ReactNode
  model: AbstractTrackModel
  feature: Feature
  baseUrl: string
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const view = getLinearGenomeView(model)
  const transcriptSelection = useTranscriptSelection({ feature, view })
  const { proteinSequence, error } = transcriptSelection

  const s2 = cleanProteinSequence(proteinSequence)
  const link = `${baseUrl}?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${s2}`
  const link2 = `${baseUrl}?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${shorten2(s2, 10)}`

  return (
    <>
      <LaunchPanelContent error={error}>
        {children}

        <TranscriptSelector feature={feature} {...transcriptSelection} />

        {proteinSequence ? (
          <div className={classes.ncbiLink}>
            Link to NCBI BLAST: <ExternalLink href={link}>{link2}</ExternalLink>
          </div>
        ) : null}

        <Typography className={classes.infoText}>
          Click the link above and run your BLAST query, and once you have
          results, click "Multiple Alignment" at the top of the results page to
          be redirected to COBALT, NCBI's multiple sequence aligner. Once COBALT
          completes, you can download an MSA (.aln file) and optionally a Newick
          tree (.nh) and paste the results into JBrowse
        </Typography>
      </LaunchPanelContent>

      <DialogActions>
        <Button
          color="primary"
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
