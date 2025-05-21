import React, { useEffect, useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import {
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import TextField2 from '../../../TextField2'
import {
  AbstractTrackModel,
  Feature,
  FileLocation,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
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
  const [inputMethod, setInputMethod] = useState('file') // 'file' or 'text'
  const [msaText, setMsaText] = useState('')
  const [treeText, setTreeText] = useState('')

  const [geneNameList, setGeneNameList] = useState<string[]>()
  const [msaFileLocation, setMsaFileLocation] = useState<FileLocation>()
  const [treeFileLocation, setTreeFileLocation] = useState<FileLocation>()

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
        <FormControl component="fieldset" style={{ marginBottom: '20px' }}>
          <RadioGroup
            aria-label="input-method"
            name="input-method"
            value={inputMethod}
            onChange={event => setInputMethod(event.target.value)}
            row
          >
            <FormControlLabel
              value="file"
              control={<Radio />}
              label="Open files"
            />
            <FormControlLabel
              value="text"
              control={<Radio />}
              label="Paste text"
            />
          </RadioGroup>
        </FormControl>

        {inputMethod === 'file' ? (
          <>
            <Typography variant="subtitle1">MSA File</Typography>
            <FileSelector
              location={msaFileLocation}
              setLocation={setMsaFileLocation}
            />
            <Typography variant="subtitle1" style={{ marginTop: '20px' }}>
              Tree File
            </Typography>
            <FileSelector
              location={treeFileLocation}
              setLocation={setTreeFileLocation}
            />
          </>
        ) : (
          <>
            <Typography variant="subtitle1">
              Paste MSA here (clustal .aln, aligned .fa/.mfa, etc.)
            </Typography>
            <TextField2
              variant="outlined"
              multiline
              minRows={5}
              maxRows={10}
              fullWidth
              value={msaText}
              onChange={event => setMsaText(event.target.value)}
              placeholder="Paste MSA here"
              style={{ marginBottom: '20px' }}
            />
            <Typography variant="subtitle1">
              Paste newick tree here (.nh)
            </Typography>
            <TextField2
              variant="outlined"
              multiline
              minRows={5}
              maxRows={10}
              fullWidth
              value={treeText}
              onChange={event => setTreeText(event.target.value)}
              placeholder="Paste newick tree (optional)"
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          disabled={
            !ret ||
            (inputMethod === 'file' && !msaFileLocation) ||
            (inputMethod === 'text' && !msaText.trim())
          }
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                if (!ret) {
                  return
                }

                if (inputMethod === 'file') {
                  // Handle file input
                  await preCalculatedLaunchView({
                    userSelection,
                    session,
                    newViewTitle: getGeneDisplayName(ret),
                    view,
                    feature: ret,
                    msaFileLocation,
                    treeFileLocation,
                  })
                } else {
                  // Handle text input
                  await preCalculatedLaunchView({
                    userSelection,
                    session,
                    newViewTitle: getGeneDisplayName(ret),
                    view,
                    feature: ret,
                    data: {
                      msa: msaText,
                      tree: treeText,
                    },
                  })
                }

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
