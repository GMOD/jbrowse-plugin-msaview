import React, { useMemo, useState } from 'react'

import { LoadingEllipses, SanitizedHTML } from '@jbrowse/core/ui'
import { getEnv, getSession } from '@jbrowse/core/util'
import { MenuItem, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import TextField2 from '../../../components/TextField2'
import { useFetch } from '../../../utils/useFetch'
import { resolveQueryRowName, useQueryRowName } from '../../useQueryRowName'
import {
  findDatasetId,
  getGeneDisplayName,
  getLinearGenomeView,
  getTranscriptDisplayName,
} from '../../util'
import LaunchPanelContent from '../LaunchPanelContent'
import QueryRowSelector from '../QueryRowSelector'
import SequenceStatusMessage from '../SequenceStatus'
import SubmitCancelActions from '../SubmitCancelActions'
import TranscriptSelector from '../TranscriptSelector'
import { launchConnectedView, useLaunchSubmit } from '../launchConnectedView'
import { useTranscriptSelection } from '../useTranscriptSelection'
import { fetchMSA, fetchMSAList } from './fetchMSAData'
import { readMsaDatasets } from './types'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  selectedContainer: {
    marginTop: 50,
  },
})

const PreLoadedMSA = observer(function ({
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
  const session = getSession(model)
  const view = getLinearGenomeView(model)
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const { assemblyNames } = view
  const assemblyName = assemblyNames[0]
  const { launchError, submit } = useLaunchSubmit(handleClose)

  const datasets = readMsaDatasets(session.jbrowse)
  const [selectedDatasetId, setSelectedDatasetId] = useState(
    datasets?.[0]?.datasetId,
  )
  const selectedDataset = datasets?.find(d => d.datasetId === selectedDatasetId)
  const {
    data: msaList,
    isLoading: msaListLoading,
    error: msaListFetchError,
  } = useFetch(
    selectedDataset
      ? `${selectedDataset.datasetId}-${assemblyName}-msa-list`
      : null,
    () =>
      fetchMSAList({
        config: selectedDataset!.adapter,
        pluginManager,
        assemblyName,
      }),
  )

  const msaIds = useMemo(() => msaList && new Set(msaList), [msaList])
  const transcriptSelection = useTranscriptSelection({
    feature,
    view,
    hasData: msaIds
      ? transcript => !!findDatasetId(transcript, feature, msaIds)
      : undefined,
    preferredTranscriptId,
  })
  const { selectedTranscript, proteinSequence, sequenceStatus } =
    transcriptSelection

  // the dataset's name for this transcript, which a track is free not to use
  // as the feature's own id
  const msaId =
    selectedTranscript && msaIds
      ? findDatasetId(selectedTranscript, feature, msaIds)
      : undefined
  const {
    data: msaData,
    isLoading: msaDataLoading,
    error: msaDataFetchError,
  } = useFetch(
    msaId && selectedDataset
      ? `${selectedDataset.datasetId}-${assemblyName}-${msaId}-msa`
      : null,
    () =>
      fetchMSA({
        msaId: msaId!,
        assemblyName,
        config: selectedDataset!.adapter,
        pluginManager,
      }),
  )

  const msaText = msaData?.msa ?? ''

  // The dataset's row for this transcript used to be assumed -- the launch
  // named `<transcriptId>_<assembly>` and hoped the file agreed. Nothing
  // checked, and a name the alignment does not carry fails silently: the view
  // opens, renders, and never navigates. The row is found by sequence instead,
  // the same way the Manual tab finds it.
  const queryRow = useQueryRowName(
    msaText,
    proteinSequence,
    msaData?.queryRowName,
  )

  // The name this panel used to launch with unconditionally. A dataset built to
  // that convention does carry the row, so it is worth falling back to when the
  // residues do not match closely enough to find it -- but only when the
  // alignment really has it, which is the check the old code never made.
  const querySeqName = resolveQueryRowName(
    queryRow,
    `${msaId ?? ''}_${assemblyName ?? ''}`,
  )

  const e =
    msaListFetchError ??
    msaDataFetchError ??
    transcriptSelection.error ??
    launchError
  return (
    <>
      <LaunchPanelContent error={e}>
        <TextField2
          select
          label="Select MSA dataset"
          value={selectedDatasetId}
          onChange={event => {
            setSelectedDatasetId(event.target.value)
          }}
        >
          {datasets?.map(d => (
            <MenuItem key={d.datasetId} value={d.datasetId}>
              {d.name}
            </MenuItem>
          ))}
        </TextField2>

        {selectedDataset ? (
          <div className={classes.selectedContainer}>
            {!msaListLoading && msaDataLoading ? (
              <LoadingEllipses
                variant="h6"
                message={`Loading MSA for ${getTranscriptDisplayName(selectedTranscript) || msaId}`}
              />
            ) : null}
            {msaListLoading ? (
              <LoadingEllipses
                variant="h6"
                message={`Loading available MSAs for (${selectedDataset.name})`}
              />
            ) : null}

            {msaList ? (
              <div>
                <SanitizedHTML html={selectedDataset.description} />
                <TranscriptSelector
                  feature={feature}
                  {...transcriptSelection}
                />
                {msaText ? (
                  <QueryRowSelector {...queryRow} querySeqName={querySeqName} />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </LaunchPanelContent>

      <SubmitCancelActions
        model={model}
        hint={
          msaDataLoading ? (
            <LoadingEllipses message="Loading alignment" />
          ) : !!msaText && !querySeqName ? (
            <Typography color="textSecondary" variant="body2">
              no row matches this transcript
            </Typography>
          ) : (
            <SequenceStatusMessage status={sequenceStatus} />
          )
        }
        // launching without a query row opens a view that renders and then
        // never navigates, which reads as a broken feature rather than a
        // dataset that does not cover this gene
        submitDisabled={!selectedTranscript || !msaText || !querySeqName}
        onSubmit={placement => {
          if (selectedTranscript && msaText) {
            submit(() =>
              launchConnectedView({
                view,
                feature: selectedTranscript,
                placement,
                displayName: getGeneDisplayName(selectedTranscript),
                drawNodeBubbles: false,
                labelsAlignRight: true,
                showBranchLen: false,
                colWidth: 10,
                rowHeight: 12,
                residueColor: { scale: { scheme: 'percent_identity_dynamic' } },
                querySeqName,
                querySeqOffset: queryRow.querySeqOffset,
                data: { msa: msaText, tree: msaData?.tree },
              }),
            )
          }
        }}
        onCancel={handleClose}
      />
    </>
  )
})

export default PreLoadedMSA
