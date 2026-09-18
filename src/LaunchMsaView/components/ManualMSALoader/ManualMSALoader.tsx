import React, { useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import { openLocation } from '@jbrowse/core/util/io'
import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import TextField2 from '../../../components/TextField2'
import { useDebounced, useFetch } from '../../../utils/useFetch'
import { useQueryRowName } from '../../useQueryRowName'
import { getGeneDisplayName, getLinearGenomeView } from '../../util'
import LaunchPanelContent from '../LaunchPanelContent'
import QueryRowSelector from '../QueryRowSelector'
import SequenceStatusMessage from '../SequenceStatus'
import SubmitCancelActions from '../SubmitCancelActions'
import TranscriptSelector from '../TranscriptSelector'
import { launchConnectedView, useLaunchSubmit } from '../launchConnectedView'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type {
  AbstractTrackModel,
  Feature,
  FileLocation,
} from '@jbrowse/core/util'

/**
 * The chosen file's text, so its query row is found by sequence the way a
 * pasted alignment's is; without it a file launch named no row and never
 * linked to the genome. Debounced because a URL arrives a keystroke at a time.
 */
function useMsaFileText(location: FileLocation | undefined) {
  const debounced = useDebounced(location, 500)
  const { data } = useFetch(
    debounced ? [JSON.stringify(debounced), 'msa-file-text'] : null,
    () => openLocation(debounced!).readFile('utf8'),
  )
  return data ?? ''
}

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
  preferredTranscriptId,
}: {
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
  /** the isoform the user right-clicked, preselected in the picker */
  preferredTranscriptId?: string
}) {
  const view = getLinearGenomeView(model)
  const { classes } = useStyles()
  const { launchError, submit } = useLaunchSubmit(handleClose)
  const [inputMethod, setInputMethod] = useState<'file' | 'text'>('file')
  const [msaText, setMsaText] = useState('')
  const [treeText, setTreeText] = useState('')
  const [msaFileLocation, setMsaFileLocation] = useState<FileLocation>()
  const [treeFileLocation, setTreeFileLocation] = useState<FileLocation>()
  const transcriptSelection = useTranscriptSelection({
    feature,
    view,
    preferredTranscriptId,
  })
  const { selectedTranscript, proteinSequence, error, sequenceStatus } =
    transcriptSelection
  const msaFileText = useMsaFileText(
    inputMethod === 'file' ? msaFileLocation : undefined,
  )
  const queryRow = useQueryRowName(
    inputMethod === 'file' ? msaFileText : msaText,
    proteinSequence,
  )

  const e = launchError ?? error
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
        model={model}
        hint={<SequenceStatusMessage status={sequenceStatus} />}
        submitDisabled={
          !selectedTranscript ||
          (inputMethod === 'file' && !msaFileLocation) ||
          (inputMethod === 'text' && !msaText.trim())
        }
        onSubmit={placement => {
          if (selectedTranscript) {
            submit(() => {
              launchConnectedView({
                view,
                feature: selectedTranscript,
                placement,
                displayName: getGeneDisplayName(selectedTranscript),
                querySeqName: queryRow.querySeqName,
                querySeqOffset: queryRow.querySeqOffset,
                ...(inputMethod === 'file'
                  ? {
                      msaFilehandle: msaFileLocation,
                      treeFilehandle: treeFileLocation,
                    }
                  : { data: { msa: msaText, tree: treeText } }),
              })
            })
          }
        }}
        onCancel={handleClose}
      />
    </>
  )
})

export default ManualMSALoader
