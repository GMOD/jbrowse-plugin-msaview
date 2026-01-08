import React, { useState } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent, Link } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { ensemblGeneTreeLaunchView } from './ensemblGeneTreeLaunchView'
import { useGeneTree } from './useGeneTree'
import { getGeneDisplayName } from '../../util'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
})

const EnsemblGeneTree = observer(function ({
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
  const {
    options,
    selectedId,
    setSelectedId,
    selectedTranscript,
    proteinSequence,
    error: featureSequenceError,
  } = useTranscriptSelection({ feature, view })
  const { treeData, isTreeLoading, treeError } = useGeneTree(selectedId)

  const loadingMessage = isTreeLoading
    ? 'Loading tree data from Ensembl GeneTree'
    : undefined
  const e = treeError ?? launchViewError ?? featureSequenceError

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {e ? <ErrorMessage error={e} /> : null}
        {loadingMessage ? <LoadingEllipses message={loadingMessage} /> : null}
        {treeData ? (
          <div>
            <div>Found Ensembl Compara GeneTree: {treeData.geneTreeId}</div>
            <Link
              target="_blank"
              href={`https://useast.ensembl.org/Multi/GeneTree/Image?gt=${treeData.geneTreeId}`}
            >
              See {treeData.geneTreeId} at Ensembl
            </Link>
          </div>
        ) : null}

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
          onClick={() => {
            try {
              if (!treeData) {
                return
              }
              setLaunchViewError(undefined)

              ensemblGeneTreeLaunchView({
                feature,
                view,
                session,
                newViewTitle: getGeneDisplayName(feature),
                data: treeData,
              })
              handleClose()
            } catch (e) {
              console.error(e)
              setLaunchViewError(e)
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

export default EnsemblGeneTree
