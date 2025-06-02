import React, { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { getContainingView, shorten2 } from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import ExternalLink from '../../../components/ExternalLink'
import { getId, getTranscriptFeatures } from '../../util'
import TranscriptSelector from '../TranscriptSelector'
import { useFeatureSequence } from '../useFeatureSequence'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
  ncbiLink: {
    wordBreak: 'break-all',
    margin: 30,
    maxWidth: 600,
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
  const view = getContainingView(model) as LinearGenomeViewModel
  const options = getTranscriptFeatures(feature)
  const [userSelection, setUserSelection] = useState(getId(options[0]))
  const selectedTranscript = options.find(val => getId(val) === userSelection)!
  const { proteinSequence, error } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })

  const s2 = proteinSequence.replaceAll('*', '').replaceAll('&', '')
  const link = `${baseUrl}?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${s2}`
  const link2 = `${baseUrl}?PAGE_TYPE=BlastSearch&PAGE=Proteins&PROGRAM=blastp&QUERY=${shorten2(s2, 10)}`

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {children}
        {error ? <ErrorMessage error={error} /> : null}

        <TranscriptSelector
          feature={feature}
          options={options}
          selectedTranscriptId={userSelection}
          onTranscriptChange={setUserSelection}
          proteinSequence={proteinSequence}
        />

        {proteinSequence ? (
          <div className={classes.ncbiLink}>
            Link to NCBI BLAST: <ExternalLink href={link}>{link2}</ExternalLink>
          </div>
        ) : null}

        <Typography style={{ marginTop: 20 }}>
          Click the link above and run your BLAST query, and once you have
          results, click "Multiple Alignment" at the top of the results page to
          be redirected to COBALT, NCBI's multiple sequence aligner. Once COBALT
          completes, you can download an MSA (.aln file) and optionally a Newick
          tree (.nh) and paste the results into JBrowse
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            handleClose()
          }}
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

export default NCBIBlastManualPanel
