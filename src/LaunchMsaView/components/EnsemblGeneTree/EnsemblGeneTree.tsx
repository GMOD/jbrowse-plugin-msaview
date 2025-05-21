import React, { useEffect, useState } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
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

import { geneTreeFetcher } from './ensemblGeneTreeUtils'
import { preCalculatedLaunchView } from './preCalculatedLaunchView'
import {
  getGeneDisplayName,
  getId,
  getTranscriptDisplayName,
  getTranscriptFeatures,
} from '../../util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { ensemblGeneTreeLaunchView } from './ensemblGeneTreeLaunchView'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

type Ret = Awaited<ReturnType<typeof geneTreeFetcher>>

const EnsemblGeneTree = observer(function ({
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
  const [treeData, setTreeData] = useState<Ret>()
  const [isTreeLoading, setIsTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState<unknown>()
  const options = getTranscriptFeatures(feature)
  const [userSelection, setUserSelection] = useState(getId(options[0]))

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setIsTreeLoading(true)
        const result = await geneTreeFetcher(userSelection)
        setTreeData(result)
      } catch (e) {
        console.error(e)
        setTreeError(e)
      } finally {
        setIsTreeLoading(false)
      }
    })()
  }, [userSelection])

  const loadingMessage = isTreeLoading
    ? 'Loading tree data from Ensembl GeneTree'
    : undefined
  const e = treeError ?? error

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {e ? <ErrorMessage error={e} /> : null}
        {loadingMessage ? <LoadingEllipses message={loadingMessage} /> : null}
        <Typography>Load data from Ensembl GeneTree</Typography>
        <TextField
          select
          label="Choose isoform to view MSA for"
          value={userSelection}
          onChange={event => {
            setUserSelection(event.target.value)
          }}
        >
          {options.map(val => (
            <MenuItem value={getId(val)} key={val.id()}>
              {getTranscriptDisplayName(val)}
            </MenuItem>
          ))}
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
                if (!treeData) {
                  return
                }
                setError(undefined)

                ensemblGeneTreeLaunchView({
                  feature,
                  view,
                  session,
                  newViewTitle: 'hello',
                  data: treeData,
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

export default EnsemblGeneTree
