import React, { useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  FileLocation,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  Button,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { launchView } from './launchView'
import TextField2 from '../../../TextField2'
import { getGeneDisplayName, getId, getTranscriptFeatures } from '../../util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

const ManualMSALoader = observer(function PreLoadedMSA2({
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

  const [msaFileLocation, setMsaFileLocation] = useState<FileLocation>()
  const [treeFileLocation, setTreeFileLocation] = useState<FileLocation>()

  const options = getTranscriptFeatures(feature)
  const [userSelection, setUserSelection] = useState(getId(options[0]))
  const ret = options.find(val => userSelection === getId(val))

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        <FormControl component="fieldset" style={{ marginBottom: '20px' }}>
          <RadioGroup
            aria-label="input-method"
            name="input-method"
            value={inputMethod}
            onChange={event => {
              setInputMethod(event.target.value)
            }}
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
              onChange={event => {
                setMsaText(event.target.value)
              }}
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
              onChange={event => {
                setTreeText(event.target.value)
              }}
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

                await launchView({
                  session,
                  newViewTitle: getGeneDisplayName(ret),
                  view,
                  feature: ret,
                  data:
                    inputMethod === 'file'
                      ? {
                          msa: msaFileLocation
                            ? await openLocation(msaFileLocation).readFile(
                                'utf8',
                              )
                            : '',
                          tree: treeFileLocation
                            ? await openLocation(treeFileLocation).readFile(
                                'utf8',
                              )
                            : undefined,
                        }
                      : {
                          msa: msaText,
                          tree: treeText,
                        },
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

export default ManualMSALoader
