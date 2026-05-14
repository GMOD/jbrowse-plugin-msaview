import React, { useState } from 'react'

import { ErrorMessage, LoadingEllipses, SanitizedHTML } from '@jbrowse/core/ui'
import { getContainingView, getEnv, getSession } from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent, MenuItem } from '@mui/material'
import { observer } from 'mobx-react'
import useSWR from 'swr'
import { makeStyles } from 'tss-react/mui'

import TextField2 from '../../../components/TextField2'
import { getGeneDisplayName } from '../../util'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'
import { swrFlags } from './consts'
import { fetchMSA, fetchMSAList } from './fetchMSAData'
import { preCalculatedLaunchView } from './preCalculatedLaunchView'
import { readMsaDatasets } from './types'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
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
  const view = getContainingView(model) as LinearGenomeViewModel
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
    swrFlags,
  )

  const {
    options: transcripts,
    selectedId,
    setSelectedId,
    selectedTranscript,
    proteinSequence,
    error: proteinSequenceError,
  } = useTranscriptSelection({ feature, view, validIds: msaList })

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
    swrFlags,
  )

  const e =
    msaListFetchError ?? msaDataFetchError ?? proteinSequenceError ?? viewError
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
                  options={transcripts}
                  selectedId={selectedId}
                  selectedTranscript={selectedTranscript}
                  onTranscriptChange={setSelectedId}
                  proteinSequence={proteinSequence}
                  validIds={msaList}
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
          disabled={!selectedTranscript || !msaData?.length}
          onClick={() => {
            try {
              if (!selectedTranscript || !msaData) {
                return
              }
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
