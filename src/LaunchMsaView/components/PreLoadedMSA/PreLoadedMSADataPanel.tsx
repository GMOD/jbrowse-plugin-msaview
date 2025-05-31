import React, { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { ErrorMessage, LoadingEllipses, SanitizedHTML } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  getContainingView,
  getEnv,
  getSession,
} from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent, MenuItem } from '@mui/material'
import { observer } from 'mobx-react'
import useSWR from 'swr'
import { makeStyles } from 'tss-react/mui'

import TextField2 from '../../../TextField2'
import { getGeneDisplayName, getId, getTranscriptFeatures } from '../../util'
import TranscriptSelector from '../TranscriptSelector'
import { useFeatureSequence } from '../useFeatureSequence'
import { fetchMSA, fetchMSAList } from './fetchMSAData'
import { preCalculatedLaunchView } from './preCalculatedLaunchView'
import { Dataset } from './types'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

const swrFlags = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  refreshWhenHidden: false,
  refreshWhenOffline: false,
  shouldRetryOnError: false,
}

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
  const { pluginManager } = getEnv(model)
  const options = getTranscriptFeatures(feature)
  const [selectedTranscriptId, setSelectedTranscriptId] = useState(
    getId(options[0]),
  )
  const [viewError, setViewError] = useState<unknown>()
  const selectedTranscript = selectedTranscriptId
    ? options.find(val => getId(val) === selectedTranscriptId)
    : undefined
  const { proteinSequence, error: proteinSequenceError } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })

  const { jbrowse } = session
  const datasets = readConfObject(jbrowse, ['msa', 'datasets']) as
    | Dataset[]
    | undefined
  const [selectedDatasetId, setSelectedDatasetId] = useState(
    datasets?.[0]?.datasetId,
  )
  const selectedDataset = datasets?.find(d => d.datasetId === selectedDatasetId)
  const {
    data: msaList,
    isLoading: msaListLoading,
    error: msaListFetchError,
  } = useSWR(
    selectedDatasetId ? `${selectedDatasetId}-msa-list` : 'none-msa-list',
    () =>
      selectedDataset
        ? fetchMSAList({
            config: selectedDataset.adapter,
            pluginManager,
          })
        : undefined,
    swrFlags,
  )
  const {
    data: msaData,
    isLoading: msaDataLoading,
    error: msaDataFetchError,
  } = useSWR(
    selectedTranscriptId && selectedDatasetId
      ? `${selectedTranscriptId}-${selectedTranscriptId}-msa`
      : 'none-msa',
    () =>
      selectedTranscriptId && selectedDataset
        ? fetchMSA({
            msaId: selectedTranscriptId,
            config: selectedDataset.adapter,
            pluginManager,
          })
        : undefined,
    swrFlags,
  )

  const e =
    msaListFetchError ?? msaDataFetchError ?? proteinSequenceError ?? viewError
  if (e) {
    console.error(e)
  }
  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {e ? <ErrorMessage error={e} /> : null}

        <TextField2
          select
          label="Select MSA dataset"
          value={selectedDatasetId}
          onChange={event => {
            setSelectedDatasetId(event.target.value)
          }}
        >
          {datasets && datasets.length > 0 ? (
            datasets.map(d => (
              <MenuItem key={d.datasetId} value={d.datasetId}>
                {d.name}
              </MenuItem>
            ))
          ) : (
            <MenuItem>No MSA datasets found</MenuItem>
          )}
        </TextField2>

        {selectedDataset ? (
          <div style={{ marginTop: 50 }}>
            {!msaListLoading && msaDataLoading ? (
              <LoadingEllipses
                variant="h6"
                message={`Loading MSA for (${selectedTranscriptId})`}
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
                  options={options}
                  selectedTranscriptId={selectedTranscriptId}
                  onTranscriptChange={setSelectedTranscriptId}
                  proteinSequence={proteinSequence}
                  validSet={new Set(msaList)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          disabled={!selectedTranscript || !msaData}
          onClick={() => {
            try {
              if (!selectedTranscript || !msaData) {
                return
              }
              preCalculatedLaunchView({
                session,
                newViewTitle: getGeneDisplayName(selectedTranscript),
                view,
                feature: selectedTranscript,
                data: {
                  msa: msaData
                    .map(r => `>${r.get('refName')}\n${r.get('seq')}`)
                    .join('\n'),
                },
              })
              handleClose()
            } catch (e) {
              setViewError(e)
            }
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
