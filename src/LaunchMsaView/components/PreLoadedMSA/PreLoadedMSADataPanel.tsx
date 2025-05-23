import React, { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { fetchGeneList } from './fetchGeneList'
import { preCalculatedLaunchView } from './preCalculatedLaunchView'
import ExternalLink from '../../../ExternalLink'
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
  const [error, setError] = useState<unknown>()
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
  const set = new Set(geneNameList)
  const options = getTranscriptFeatures(feature)
  const ret = options.find(val => set.has(getId(val)))
  const [userSelection, setUserSelection] = useState(getId(options[0]))

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        <Typography>
          The source data for these multiple sequence alignments is from{' '}
          <ExternalLink href="https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz100way/alignments/">
            knownCanonical.multiz100way.protAA.fa.gz
          </ExternalLink>
        </Typography>
        {error ? <ErrorMessage error={error} /> : null}
        {geneNameList && !ret ? (
          <Typography color="error">No MSA data for this gene found</Typography>
        ) : null}
        <TextField
          select
          variant="outlined"
          label="Choose isoform to view MSA for"
          value={userSelection}
          onChange={event => {
            setUserSelection(event.target.value)
          }}
        >
          {options.map(val => {
            const inSet = set.has(getId(val))
            return (
              <MenuItem value={getId(val)} key={val.id()} disabled={!inSet}>
                {getTranscriptDisplayName(val)} {inSet ? ' (has data)' : ''}
              </MenuItem>
            )
          })}
        </TextField>
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
