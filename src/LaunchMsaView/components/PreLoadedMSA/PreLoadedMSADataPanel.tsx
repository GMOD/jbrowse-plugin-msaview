import React, { useEffect, useMemo, useState } from 'react'

import { ErrorMessage, LoadingEllipses, SanitizedHTML } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  fetchAndMaybeUnzipText,
  getContainingView,
  getEnv,
  getSession,
} from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { fetchGeneList } from './fetchGeneList'
import { preCalculatedLaunchView } from './preCalculatedLaunchView'
import ExternalLink from '../../../ExternalLink'
import { getGeneDisplayName, getId, getTranscriptFeatures } from '../../util'
import TranscriptSelector from '../TranscriptSelector'
import { useFeatureSequence } from '../useFeatureSequence'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import TextField2 from '../../../TextField2'
import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

async function getRefNames({
  config,
  pluginManager,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
}) {
  console.log(config)
  const type = pluginManager.getAdapterType(config.type)!
  const CLASS = await type.getAdapterClass()
  const adapter = new CLASS(config, undefined, pluginManager)

  // @ts-expect-error
  return adapter.getRefNames()
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
  const [error1, setError] = useState<unknown>()
  const [geneNameList, setGeneNameList] = useState<string[]>()

  const { pluginManager } = getEnv(model)
  const validSet = new Set(geneNameList)
  const options = getTranscriptFeatures(feature)
  const ret = options.find(val => validSet.has(getId(val)))
  const [loading, setLoading] = useState(false)
  const [userSelection, setUserSelection] = useState(getId(options[0]))
  const selectedTranscript = options.find(val => getId(val) === userSelection)!
  const { proteinSequence, error: error2 } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })

  const [refNames, setRefNames] = useState<string[]>()
  const e = error1 ?? error2
  const { jbrowse } = session
  const datasets = useMemo(
    () => readConfObject(jbrowse, ['msa', 'datasets']),
    [jbrowse],
  )
  const [selection, setSelection] = useState<string>(datasets?.[0]?.datasetId)
  const dataset = datasets.find(d => d.datasetId === selection)
  console.log({ refNames })

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        if (dataset) {
          setLoading(true)
          console.log(dataset, dataset?.adapter?.faiLocation)
          const ret = await getRefNames({
            config: dataset.adapter,
            pluginManager,
          })

          for (let i = 0; i < ret.length; i++) {}
          const [base, species] = setRefNames(ret)
        }
      } catch (e) {
        console.error(e)
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [dataset])

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {e ? <ErrorMessage error={e} /> : null}

        <TextField2
          select
          value={selection}
          onChange={event => setSelection(event.target.value)}
        >
          {datasets.length ? (
            datasets.map(d => (
              <MenuItem key={d.datasetId} value={d.datasetId}>
                {d.name}
              </MenuItem>
            ))
          ) : (
            <MenuItem>No datasets</MenuItem>
          )}
        </TextField2>

        {loading ? <LoadingEllipses /> : null}
        {dataset ? (
          <div>
            <SanitizedHTML html={dataset.description} />
            {geneNameList && !ret ? (
              <Typography color="error">
                No MSA data for this gene found
              </Typography>
            ) : null}
            <TranscriptSelector
              feature={feature}
              options={options}
              selectedTranscriptId={userSelection}
              onTranscriptChange={setUserSelection}
              proteinSequence={proteinSequence}
              validSet={validSet}
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
                if (!ret) {
                  return
                }
                await preCalculatedLaunchView({
                  userSelection,
                  session,
                  newViewTitle: getGeneDisplayName(ret),
                  view,
                  feature: ret,
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

export default PreLoadedMSA
