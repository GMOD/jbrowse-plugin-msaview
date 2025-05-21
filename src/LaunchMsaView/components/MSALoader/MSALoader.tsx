import React, { useEffect, useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  FileLocation,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { fetchGeneList } from './fetchGeneList'
import { preCalculatedLaunchView } from './preCalculatedLaunchView'
import { getGeneDisplayName, getId, getTranscriptFeatures } from '../../util'

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
  const [, setError] = useState<unknown>()
  const [geneNameList, setGeneNameList] = useState<string[]>()
  const [fileLocation, setFileLocation] = useState<FileLocation>()

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

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        if (fileLocation) {
          await openLocation(fileLocation).readFile()
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [fileLocation, feature])

  const set = new Set(geneNameList)
  const options = getTranscriptFeatures(feature)
  const ret = options.find(val => set.has(getId(val)))
  const [userSelection, setUserSelection] = useState(getId(options[0]))

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        <FileSelector location={fileLocation} setLocation={setFileLocation} />
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
