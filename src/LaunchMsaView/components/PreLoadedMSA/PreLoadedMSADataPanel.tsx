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
    selectedDataset ? `${selectedDataset.datasetId}-msa-list` : null,
    () => fetchMSAList({ config: selectedDataset!.adapter, pluginManager }),
  )

  const transcriptSelection = useTranscriptSelection({
    feature,
    view,
    validIds: msaList,
    preferredTranscriptId,
  })
  const { selectedId, selectedTranscript, proteinSequence, sequenceStatus } =
    transcriptSelection

  const {
    data: msaData,
    isLoading: msaDataLoading,
    error: msaDataFetchError,
  } = useFetch(
    selectedId && selectedDataset && msaList
      ? `${selectedDataset.datasetId}-${selectedId}-msa`
      : null,
    () =>
      fetchMSA({
        msaId: selectedId,
        config: selectedDataset!.adapter,
        pluginManager,
      }),
  )

  const msaText = useMemo(
    () =>
      msaData?.map(r => `>${r.get('refName')}\n${r.get('seq')}`).join('\n') ??
      '',
    [msaData],
  )

  // The dataset's row for this transcript used to be assumed -- the launch
  // named `<transcriptId>_<assembly>` and hoped the file agreed. Nothing
  // checked, and a name the alignment does not carry fails silently: the view
  // opens, renders, and never navigates. The row is found by sequence instead,
  // the same way the Manual tab finds it.
  const queryRow = useQueryRowName(msaText, proteinSequence)

  // The name this panel used to launch with unconditionally. A dataset built to
  // that convention does carry the row, so it is worth falling back to when the
  // residues do not match closely enough to find it -- but only when the
  // alignment really has it, which is the check the old code never made.
  const querySeqName = resolveQueryRowName(
    queryRow,
    `${selectedId}_${assemblyNames[0] ?? ''}`,
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
                message={`Loading MSA for ${getTranscriptDisplayName(selectedTranscript) || selectedId}`}
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
          ) : !!msaData?.length && !querySeqName ? (
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
        submitDisabled={
          !selectedTranscript || !msaData?.length || !querySeqName
        }
        onSubmit={placement => {
          if (selectedTranscript && msaText) {
            submit(() => {
              launchConnectedView({
                view,
                feature: selectedTranscript,
                placement,
                displayName: getGeneDisplayName(selectedTranscript),
                treeAreaWidth: 200,
                treeWidth: 100,
                drawNodeBubbles: false,
                labelsAlignRight: true,
                showBranchLen: false,
                colWidth: 10,
                rowHeight: 12,
                colorSchemeName: 'percent_identity_dynamic',
                querySeqName,
                querySeqOffset: queryRow.querySeqOffset,
                data: { msa: msaText },
              })
            })
          }
        }}
        onCancel={handleClose}
      />
    </>
  )
})

export default PreLoadedMSA
