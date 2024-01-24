import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { ErrorMessage } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import {
  AbstractTrackModel,
  Feature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'

// locals
import { getDisplayName, getId, getTranscriptFeatures } from '../util'
import { fetchGeneList } from '../fetchGeneList'
import { preCalculatedLaunchView } from '../preCalculatedLaunchView'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

const PreLoadedMSA = observer(function ({
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
          <a href="https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz100way/alignments/">
            knownCanonical.multiz100way.protAA.fa.gz
          </a>
        </Typography>
        {error ? <ErrorMessage error={error} /> : null}
        {geneNameList && !ret ? (
          <div style={{ color: 'red' }}>No MSA data for this gene found</div>
        ) : null}
        <TextField
          value={userSelection}
          onChange={event => setUserSelection(event.target.value)}
          label="Choose isoform to view MSA for"
          select
        >
          {options
            .filter(val => set.has(getId(val)))
            .map(val => {
              const d = getDisplayName(val)
              return (
                <MenuItem value={getId(val)} key={val.id()}>
                  {d} (has data)
                </MenuItem>
              )
            })}
          {options
            .filter(val => !set.has(getId(val)))
            .map(val => {
              const d = getDisplayName(val)
              return (
                <MenuItem value={getId(val)} key={val.id()} disabled>
                  {d}
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
                  newViewTitle: '',
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
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default PreLoadedMSA
