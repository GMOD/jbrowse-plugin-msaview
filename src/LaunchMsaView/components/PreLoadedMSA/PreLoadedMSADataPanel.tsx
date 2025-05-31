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
import { getId, getTranscriptFeatures } from '../../util'
import TranscriptSelector from '../TranscriptSelector'
import { useFeatureSequence } from '../useFeatureSequence'
import { fetchAdapterMSAList } from './fetchAdapterMSAList'
import { Dataset } from './types'

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
  const { pluginManager } = getEnv(model)
  const options = getTranscriptFeatures(feature)
  const [userSelection, setUserSelection] = useState(getId(options[0]))
  const [viewError, setViewError] = useState<unknown>()
  const selectedTranscript = options.find(val => getId(val) === userSelection)!
  const { proteinSequence, error: proteinSequenceError } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })

  const { jbrowse } = session
  const datasets = readConfObject(jbrowse, ['msa', 'datasets']) as Dataset[]
  const [selection, setSelection] = useState(datasets?.[0]?.datasetId)
  const dataset = datasets?.find(d => d.datasetId === selection)
  const {
    data: msaList,
    isLoading,
    error: fetchError,
  } = useSWR(
    selection ?? 'none',
    () =>
      dataset
        ? fetchAdapterMSAList({
            config: dataset.adapter,
            pluginManager,
          })
        : undefined,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      shouldRetryOnError: false,
    },
  )

  const e = fetchError ?? proteinSequenceError ?? viewError
  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {e ? <ErrorMessage error={e} /> : null}

        <TextField2
          select
          value={selection}
          onChange={event => {
            setSelection(event.target.value)
          }}
        >
          {datasets.length > 0 ? (
            datasets.map(d => (
              <MenuItem key={d.datasetId} value={d.datasetId}>
                {d.name}
              </MenuItem>
            ))
          ) : (
            <MenuItem>No datasets</MenuItem>
          )}
        </TextField2>

        {isLoading ? <LoadingEllipses /> : null}
        {msaList && dataset ? (
          <div>
            <SanitizedHTML html={dataset.description} />
            <TranscriptSelector
              feature={feature}
              options={options}
              selectedTranscriptId={userSelection}
              onTranscriptChange={setUserSelection}
              proteinSequence={proteinSequence}
              validSet={new Set(msaList)}
            />
          </div>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                // if (!ret) {
                //   return
                // }
                // await preCalculatedLaunchView({
                //   userSelection,
                //   session,
                //   newViewTitle: getGeneDisplayName(ret),
                //   view,
                //   feature: ret,
                // })
                handleClose()
              } catch (e) {
                console.error(e)
                setViewError(e)
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
