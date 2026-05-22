import React, { useState } from 'react'

import { LoadingEllipses, SanitizedHTML } from '@jbrowse/core/ui'
import { getEnv, getSession } from '@jbrowse/core/util'
import { MenuItem } from '@mui/material'
import { observer } from 'mobx-react'
import useSWR from 'swr'
import { makeStyles } from 'tss-react/mui'

import TextField2 from '../../../components/TextField2'
import { staticSwrConfig } from '../../../utils/swrConfig'
import { getGeneDisplayName, getLinearGenomeView } from '../../util'
import LaunchPanelContent from '../LaunchPanelContent'
import SubmitCancelActions from '../SubmitCancelActions'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'
import { fetchMSA, fetchMSAList } from './fetchMSAData'
import { preCalculatedLaunchView } from './preCalculatedLaunchView'
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
}: {
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
}) {
  const session = getSession(model)
  const view = getLinearGenomeView(model)
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const { assemblyNames } = view
  const [viewError, setViewError] = useState<unknown>()

  const datasets = readMsaDatasets(session.jbrowse)
  const [selectedDatasetId, setSelectedDatasetId] = useState(
    datasets?.[0]?.datasetId,
  )
  const selectedDataset = datasets?.find(d => d.datasetId === selectedDatasetId)
  const {
    data: msaList,
    isLoading: msaListLoading,
    error: msaListFetchError,
  } = useSWR(
    selectedDataset ? `${selectedDataset.datasetId}-msa-list` : null,
    () => fetchMSAList({ config: selectedDataset!.adapter, pluginManager }),
    staticSwrConfig,
  )

  const transcriptSelection = useTranscriptSelection({
    feature,
    view,
    validIds: msaList,
  })
  const { selectedId, selectedTranscript } = transcriptSelection

  const {
    data: msaData,
    isLoading: msaDataLoading,
    error: msaDataFetchError,
  } = useSWR(
    selectedId && selectedDataset && msaList
      ? `${selectedDataset.datasetId}-${selectedId}-${msaList.length}-msa`
      : null,
    () =>
      fetchMSA({
        msaId: selectedId,
        config: selectedDataset!.adapter,
        pluginManager,
      }),
    staticSwrConfig,
  )

  const e =
    msaListFetchError ??
    msaDataFetchError ??
    transcriptSelection.error ??
    viewError
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
                message={`Loading MSA for (${selectedId})`}
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
              </div>
            ) : null}
          </div>
        ) : null}
      </LaunchPanelContent>

      <SubmitCancelActions
        submitDisabled={!selectedTranscript || !msaData?.length}
        onSubmit={() => {
          try {
            if (selectedTranscript && msaData) {
              const querySeqName = `${selectedId}_${assemblyNames[0]}`
              preCalculatedLaunchView({
                session,
                newViewTitle: getGeneDisplayName(selectedTranscript),
                view,
                querySeqName,
                feature: selectedTranscript,
                data: {
                  msa: msaData
                    .map(r => `>${r.get('refName')}\n${r.get('seq')}`)
                    .join('\n'),
                },
              })
              handleClose()
            }
          } catch (e) {
            setViewError(e)
          }
        }}
        onCancel={handleClose}
      />
    </>
  )
})

export default PreLoadedMSA
