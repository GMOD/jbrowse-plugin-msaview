import React, { useMemo, useState } from 'react'

import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import QuerySpeciesSelect from './QuerySpeciesSelect'
import { orthologLaunchView } from './orthologLaunchView'
import TextField2 from '../../../components/TextField2'
import { defaultMaxSpecies } from '../../../utils/ncbiOrthologs'
import {
  getGeneDisplayName,
  getGeneIdentifiers,
  getLinearGenomeView,
  getTranscriptDisplayName,
} from '../../util'
import MsaAlgorithmSelect from '../BlastQuery/MsaAlgorithmSelect'
import LaunchPanelContent from '../LaunchPanelContent'
import SubmitCancelActions from '../SubmitCancelActions'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type { MsaAlgorithm } from '../BlastQuery/consts'
import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  selectField: {
    width: 180,
  },
})

const OrthologPanel = observer(function ({
  handleClose,
  feature,
  model,
}: {
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const view = getLinearGenomeView(model)
  const [launchViewError, setLaunchViewError] = useState<unknown>()
  const [taxId, setTaxId] = useState(9606)
  const [msaAlgorithm, setMsaAlgorithm] = useState<MsaAlgorithm>('clustalo')
  const [maxSpecies, setMaxSpecies] = useState(String(defaultMaxSpecies))

  const geneCandidates = useMemo(() => getGeneIdentifiers(feature), [feature])
  const transcriptSelection = useTranscriptSelection({ feature, view })
  const { selectedTranscript, proteinSequence } = transcriptSelection
  const e = transcriptSelection.error ?? launchViewError

  const rowCount = Number(maxSpecies)
  const rowCountValid = Number.isInteger(rowCount) && rowCount >= 2

  return (
    <>
      <LaunchPanelContent error={e}>
        {/* One line rather than seven. What a reader needs here is which tab to
            pick; the rest (species labels, CDD overlay, the query row being the
            selected transcript) is visible in the result or documented, and as
            prose it was most of the dialog's height.

            The comparison stays but the number moved: the lookup is still
            instant, and it is now the aligner that costs the wait, about half a
            second per row. */}
        <Typography variant="body2">
          NCBI&apos;s precomputed orthologs, one gene per species, looked up
          rather than searched for. No BLAST job to queue.
        </Typography>

        <div>
          <QuerySpeciesSelect
            className={classes.selectField}
            value={taxId}
            assemblyName={view.assemblyNames[0]}
            onChange={setTaxId}
          />

          <MsaAlgorithmSelect
            className={classes.selectField}
            value={msaAlgorithm}
            onChange={setMsaAlgorithm}
          />

          <TextField2
            variant="outlined"
            label="Rows to align"
            className={classes.selectField}
            type="number"
            value={maxSpecies}
            onChange={event => {
              setMaxSpecies(event.target.value)
            }}
            error={!rowCountValid}
            helperText="the closest N species NCBI has"
          />
        </div>

        <TranscriptSelector feature={feature} {...transcriptSelection} />

      </LaunchPanelContent>
      <SubmitCancelActions
        submitDisabled={!proteinSequence || !rowCountValid}
        onSubmit={() => {
          try {
            if (selectedTranscript) {
              setLaunchViewError(undefined)
              orthologLaunchView({
                feature: selectedTranscript,
                view,
                newViewTitle: `Orthologs - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)}`,
                orthologParams: {
                  taxId,
                  maxSpecies: rowCount,
                  geneCandidates,
                  msaAlgorithm,
                  selectedTranscript,
                  proteinSequence,
                },
              })
              handleClose()
            }
          } catch (e) {
            console.error(e)
            setLaunchViewError(e)
          }
        }}
        onCancel={handleClose}
      />
    </>
  )
})

export default OrthologPanel
