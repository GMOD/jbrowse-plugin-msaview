import React, { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { fetchGeneList } from './fetchGeneList'
import { preCalculatedLaunchView } from './preCalculatedLaunchView'
import ExternalLink from '../../../ExternalLink'
import { getGeneDisplayName, getId, getTranscriptFeatures } from '../../util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { useFeatureSequence } from '../useFeatureSequence'
import TranscriptSelector from '../TranscriptSelector'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

const PreLoadedMSA = observer(function PreLoadedMSA2({
  model,
  feature,
  handleClose,
}: {
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
}) {
  const session = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { classes } = useStyles()
  const [error1, setError] = useState<unknown>()
  const [geneNameList, setGeneNameList] = useState<string[]>()
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const data = await fetchGeneList()
        setGeneNameList(data)
        const set = new Set(data)
        const options = getTranscriptFeatures(feature)
        const ret = options.find(val => set.has(getId(val)))
        if (ret) {
          setUserSelection(getId(ret))
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [feature])
  const validSet = new Set(geneNameList)
  const options = getTranscriptFeatures(feature)
  const ret = options.find(val => validSet.has(getId(val)))
  const [userSelection, setUserSelection] = useState(getId(options[0]))
  const selectedTranscript = options.find(val => getId(val) === userSelection)!
  const { proteinSequence, error: error2 } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })

  const e = error1 ?? error2

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {e ? <ErrorMessage error={e} /> : null}
        <Typography>
          The source data for these multiple sequence alignments is from{' '}
          <ExternalLink href="https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz100way/alignments/">
            knownCanonical.multiz100way.protAA.fa.gz
          </ExternalLink>
        </Typography>
        {geneNameList && !ret ? (
          <Typography color="error">No MSA data for this gene found</Typography>
        ) : null}
        <TranscriptSelector
          feature={feature}
          options={options}
          selectedTranscriptId={userSelection}
          onTranscriptChange={setUserSelection}
          proteinSequence={proteinSequence}
          validSet={validSet}
        />
      </DialogContent>

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                if (!ret) {
                  return
                }
                await preCalculatedLaunchView({
                  userSelection,
                  session,
                  newViewTitle: getGeneDisplayName(ret),
                  view,
                  feature: ret,
                })
                handleClose()
              } catch (e) {
                console.error(e)
                setError(e)
              }
            })()
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
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default PreLoadedMSA
