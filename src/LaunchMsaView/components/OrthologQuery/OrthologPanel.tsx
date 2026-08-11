import React, { useMemo, useState } from 'react'

import { Checkbox, FormControlLabel, MenuItem, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { orthologLaunchView } from './orthologLaunchView'
import TextField2 from '../../../components/TextField2'
import { COMMON_SPECIES } from '../../../utils/ncbiOrthologs'
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
  // A GRID, not a wrapping flex row of fixed-width items. The old form was three
  // 160px columns inside a 560px box, which is five rows for thirteen species and
  // eight for twenty-three -- and the checkbox list is the tallest thing in the
  // dialog, so those rows are the dialog's height. Five auto-fitted columns is
  // five rows for twenty-three, i.e. more species in less space, and it reflows
  // rather than being pinned to a width the dialog may not have.
  speciesBox: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    maxWidth: 700,
    marginTop: 4,
  },
  // The label carries the row height; the default control padding is what makes
  // 23 rows of it tall.
  species: {
    marginRight: 0,
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
  const [excluded, setExcluded] = useState<number[]>([])

  const geneCandidates = useMemo(() => getGeneIdentifiers(feature), [feature])
  const transcriptSelection = useTranscriptSelection({ feature, view })
  const { selectedTranscript, proteinSequence } = transcriptSelection
  const e = transcriptSelection.error ?? launchViewError

  const taxa = COMMON_SPECIES.map(s => s.taxId).filter(
    t => !excluded.includes(t),
  )

  return (
    <>
      <LaunchPanelContent error={e}>
        {/* One line rather than seven. What a reader needs here is which tab
            to pick, and that is the seconds-against-minutes comparison; the
            rest (species labels, CDD overlay, the query row being the selected
            transcript) is visible in the result or documented, and as prose it
            was most of the dialog's height. */}
        <Typography variant="body2">
          NCBI&apos;s precomputed orthologs, one gene per species, aligned at EBI
          in seconds rather than the 10+ minutes BLAST takes.
        </Typography>

        <div>
          <TextField2
            variant="outlined"
            label="Query species"
            className={classes.selectField}
            select
            value={taxId}
            onChange={event => {
              setTaxId(Number(event.target.value))
            }}
            helperText="the species this gene is from"
          >
            {COMMON_SPECIES.map(s => (
              <MenuItem value={s.taxId} key={s.taxId}>
                {s.label}
              </MenuItem>
            ))}
          </TextField2>

          <MsaAlgorithmSelect
            className={classes.selectField}
            value={msaAlgorithm}
            onChange={setMsaAlgorithm}
          />
        </div>

        <Typography variant="subtitle2" style={{ marginTop: 8 }}>
          Species to include (those without an ortholog are skipped)
        </Typography>
        <div className={classes.speciesBox}>
          {COMMON_SPECIES.map(s => (
            <FormControlLabel
              className={classes.species}
              key={s.taxId}
              control={
                <Checkbox
                  checked={!excluded.includes(s.taxId)}
                  onChange={event => {
                    setExcluded(
                      event.target.checked
                        ? excluded.filter(t => t !== s.taxId)
                        : [...excluded, s.taxId],
                    )
                  }}
                />
              }
              label={s.label}
            />
          ))}
        </div>

        <TranscriptSelector feature={feature} {...transcriptSelection} />

      </LaunchPanelContent>
      <SubmitCancelActions
        submitDisabled={!proteinSequence || taxa.length < 2}
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
                  taxa,
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
