import React, { useMemo, useState } from 'react'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  MenuItem,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import CachedBlastResults from './CachedBlastResults'
import MsaAlgorithmSelect from './MsaAlgorithmSelect'
import { blastLaunchView } from './blastLaunchView'
import { blastDatabaseOptions, defaultBlastDatabase } from './consts'
import { useCachedBlastResults } from './useCachedBlastResults'
import TextField2 from '../../../components/TextField2'
import {
  getBlastViewTitle,
  getGeneIdentifiers,
  getLinearGenomeView,
} from '../../util'
import LaunchPanelContent from '../LaunchPanelContent'
import SubmitCancelActions from '../SubmitCancelActions'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type { BlastDatabase, MsaAlgorithm } from './consts'
import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  selectField: {
    width: 150,
  },
  cachedResultsAccordion: {
    marginTop: 20,
  },
  infoText: {
    marginTop: 20,
  },
})

const BlastAutomaticPanel = observer(function ({
  handleClose,
  feature,
  model,
  children,
}: {
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const view = getLinearGenomeView(model)
  const [launchViewError, setLaunchViewError] = useState<unknown>()
  const [selectedBlastDatabase, setSelectedBlastDatabase] =
    useState<BlastDatabase>(defaultBlastDatabase)
  const [selectedMsaAlgorithm, setSelectedMsaAlgorithm] =
    useState<MsaAlgorithm>('clustalo')

  const geneIds = useMemo(() => getGeneIdentifiers(feature), [feature])
  const { results: cachedResults, error: cachedResultsError } =
    useCachedBlastResults(geneIds)

  const transcriptSelection = useTranscriptSelection({ feature, view })
  const { selectedTranscript, proteinSequence } = transcriptSelection
  const e = transcriptSelection.error ?? launchViewError ?? cachedResultsError
  return (
    <>
      <LaunchPanelContent error={e}>
        {children}
        <TextField2
          variant="outlined"
          label="BLAST database"
          className={classes.selectField}
          select
          value={selectedBlastDatabase}
          onChange={event => {
            setSelectedBlastDatabase(event.target.value as BlastDatabase)
          }}
        >
          {blastDatabaseOptions.map(val => (
            <MenuItem value={val} key={val}>
              {val}
            </MenuItem>
          ))}
        </TextField2>

        <MsaAlgorithmSelect
          className={classes.selectField}
          value={selectedMsaAlgorithm}
          onChange={setSelectedMsaAlgorithm}
        />

        <TranscriptSelector feature={feature} {...transcriptSelection} />

        <Typography className={classes.infoText}>
          This panel will automatically submit a blastp query to EBI, which
          searches UniProtKB. Searches usually finish in under a minute, and
          swissprot returns curated sequences that align more cleanly than the
          many near-identical entries a TrEMBL search brings back. After
          completion, all the hits will be run through a multiple sequence
          alignment. Searching NCBI's nr needs the manual approach: NCBI no
          longer lets a browser read responses from Blast.cgi.
        </Typography>

        {cachedResults.length > 0 ? (
          <Accordion className={classes.cachedResultsAccordion}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Previous BLAST Results</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <CachedBlastResults
                model={model}
                handleClose={handleClose}
                feature={feature}
              />
            </AccordionDetails>
          </Accordion>
        ) : null}
      </LaunchPanelContent>
      <SubmitCancelActions
        submitDisabled={!proteinSequence}
        onSubmit={() => {
          try {
            if (selectedTranscript) {
              setLaunchViewError(undefined)
              blastLaunchView({
                feature: selectedTranscript,
                view,
                newViewTitle: getBlastViewTitle(feature, selectedTranscript),
                blastParams: {
                  blastDatabase: selectedBlastDatabase,
                  msaAlgorithm: selectedMsaAlgorithm,
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

export default BlastAutomaticPanel
