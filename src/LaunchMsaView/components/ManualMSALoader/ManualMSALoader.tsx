import React, { useState } from 'react'

import { ErrorMessage, FileSelector } from '@jbrowse/core/ui'
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
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { launchView } from './launchView'
import TextField2 from '../../../components/TextField2'
import { getGeneDisplayName } from '../../util'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
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
  const [launchViewError, setLaunchViewError] = useState<unknown>()
  const [inputMethod, setInputMethod] = useState<'file' | 'text'>('file')
  const [msaText, setMsaText] = useState('')
  const [treeText, setTreeText] = useState('')
  const [msaFileLocation, setMsaFileLocation] = useState<FileLocation>()
  const [treeFileLocation, setTreeFileLocation] = useState<FileLocation>()
  const {
    options,
    setSelectedId,
    selectedTranscript,
    proteinSequence,
    error: error2,
  } = useTranscriptSelection({ feature, view })

  const e = launchViewError ?? error2
  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {e ? <ErrorMessage error={e} /> : null}
        <FormControl component="fieldset">
          <RadioGroup
            row
            value={inputMethod}
            onChange={event => {
              setInputMethod(event.target.value as 'file' | 'text')
            }}
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

        <div style={{ marginBottom: 30 }}>
          {inputMethod === 'file' ? (
            <div style={{ maxWidth: 500 }}>
              <FileSelector
                name="MSA File .aln (Clustal), .fa/.mfa (aligned FASTA), .stock (Stockholm), etc)"
                inline
                location={msaFileLocation}
                setLocation={setMsaFileLocation}
              />
              <FileSelector
                name="Tree file .nh (Newick) or .asn (NCBI COBALT ASN.1)"
                inline
                location={treeFileLocation}
                setLocation={setTreeFileLocation}
              />
            </div>
          ) : (
            <>
              <TextField2
                variant="outlined"
                name="MSA"
                multiline
                minRows={5}
                style={{ marginBottom: '20px' }}
                maxRows={10}
                fullWidth
                placeholder="Paste MSA here"
                value={msaText}
                onChange={event => {
                  setMsaText(event.target.value)
                }}
              />
              <TextField2
                variant="outlined"
                name="Tree"
                multiline
                minRows={5}
                maxRows={10}
                fullWidth
                placeholder="Paste newick tree (optional)"
                value={treeText}
                onChange={event => {
                  setTreeText(event.target.value)
                }}
              />
            </>
          )}
        </div>

        <TranscriptSelector
          feature={feature}
          options={options}
          selectedTranscript={selectedTranscript}
          onTranscriptChange={setSelectedId}
          proteinSequence={proteinSequence}
        />
      </DialogContent>

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          disabled={
            !selectedTranscript ||
            (inputMethod === 'file' && !msaFileLocation) ||
            (inputMethod === 'text' && !msaText.trim())
          }
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                if (!selectedTranscript) {
                  return
                }

                setLaunchViewError(undefined)
                launchView({
                  session,
                  newViewTitle: getGeneDisplayName(selectedTranscript),
                  view,
                  feature: selectedTranscript,
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
                setLaunchViewError(e)
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
