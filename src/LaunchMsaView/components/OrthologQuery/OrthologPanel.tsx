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
import LaunchPanelContent from '../LaunchPanelContent'
import MsaAlgorithmSelect from '../NCBIBlastQuery/MsaAlgorithmSelect'
import SubmitCancelActions from '../SubmitCancelActions'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type { MsaAlgorithm } from '../NCBIBlastQuery/consts'
import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  selectField: {
    width: 180,
  },
  speciesBox: {
    display: 'flex',
    flexWrap: 'wrap',
    maxWidth: 560,
    marginTop: 12,
  },
  species: {
    width: 160,
  },
  infoText: {
    marginTop: 20,
    maxWidth: 620,
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
        <Typography>
          Builds the alignment from NCBI&apos;s precomputed orthologs — one gene
          per species — instead of searching. There is no job to wait on: the
          NCBI lookups take about a second, and only the multiple alignment at
          EBI costs real time (~10s), against 10+ minutes for BLAST. Rows come
          out labelled by species rather than by accession, and NCBI&apos;s CDD
          domains are overlaid automatically.
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

        <Typography variant="subtitle2" style={{ marginTop: 12 }}>
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

        <Typography className={classes.infoText} variant="body2">
          The query row is the transcript selected above, not NCBI&apos;s
          representative protein, so the alignment stays linked to the genome
          view at codon resolution.
        </Typography>
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
