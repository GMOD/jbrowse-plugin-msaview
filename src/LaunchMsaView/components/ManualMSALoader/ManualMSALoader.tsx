import React, { useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { launchView } from './launchView'
import TextField2 from '../../../components/TextField2'
import { useQueryRowName } from '../../useQueryRowName'
import { getGeneDisplayName, getLinearGenomeView } from '../../util'
import LaunchPanelContent from '../LaunchPanelContent'
import QueryRowSelector from '../QueryRowSelector'
import SubmitCancelActions from '../SubmitCancelActions'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type {
  AbstractTrackModel,
  Feature,
  FileLocation,
} from '@jbrowse/core/util'

const useStyles = makeStyles()({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
  inputContainer: {
    marginBottom: 30,
  },
  fileContainer: {
    maxWidth: 500,
  },
  msaInput: {
    marginBottom: 20,
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
  const view = getLinearGenomeView(model)
  const { classes } = useStyles()
  const [launchViewError, setLaunchViewError] = useState<unknown>()
  const [inputMethod, setInputMethod] = useState<'file' | 'text'>('file')
  const [msaText, setMsaText] = useState('')
  const [treeText, setTreeText] = useState('')
  const [msaFileLocation, setMsaFileLocation] = useState<FileLocation>()
  const [treeFileLocation, setTreeFileLocation] = useState<FileLocation>()
  const transcriptSelection = useTranscriptSelection({ feature, view })
  const { selectedTranscript, proteinSequence, error } = transcriptSelection
  const queryRow = useQueryRowName(msaText, proteinSequence)

  const e = launchViewError ?? error
  return (
    <>
      <LaunchPanelContent error={e}>
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

        <div className={classes.inputContainer}>
          {inputMethod === 'file' ? (
            <div className={classes.fileContainer}>
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
                className={classes.msaInput}
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

        <TranscriptSelector feature={feature} {...transcriptSelection} />

        <QueryRowSelector {...queryRow} />
      </LaunchPanelContent>

      <SubmitCancelActions
        submitDisabled={
          !selectedTranscript ||
          (inputMethod === 'file' && !msaFileLocation) ||
          (inputMethod === 'text' && !msaText.trim())
        }
        onSubmit={() => {
          try {
            if (selectedTranscript) {
              setLaunchViewError(undefined)
              launchView({
                newViewTitle: getGeneDisplayName(selectedTranscript),
                view,
                feature: selectedTranscript,
                querySeqName: queryRow.querySeqName,
                ...(inputMethod === 'file'
                  ? {
                      msaFilehandle: msaFileLocation,
                      treeFilehandle: treeFileLocation,
                    }
                  : {
                      data: {
                        msa: msaText,
                        tree: treeText,
                      },
                    }),
              })
              handleClose()
            }
          } catch (err) {
            console.error(err)
            setLaunchViewError(err)
          }
        }}
        onCancel={handleClose}
      />
    </>
  )
})

export default ManualMSALoader
