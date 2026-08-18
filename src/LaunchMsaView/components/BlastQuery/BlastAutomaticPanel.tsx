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
import {
  databaseOptionsFor,
  defaultBlastDatabase,
  defaultDatabaseFor,
  defaultSearchProgram,
  searchPrograms,
} from './consts'
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

import type {
  BlastDatabase,
  MsaAlgorithm,
  PhmmerDatabase,
  SearchProgram,
} from './consts'
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
  const [selectedSearchProgram, setSelectedSearchProgram] =
    useState<SearchProgram>(defaultSearchProgram)
  const [selectedDatabase, setSelectedDatabase] = useState<
    BlastDatabase | PhmmerDatabase
  >(defaultBlastDatabase)
  const [selectedMsaAlgorithm, setSelectedMsaAlgorithm] =
    useState<MsaAlgorithm>('clustalo')
  const isPhmmer = selectedSearchProgram === 'phmmer'

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
          label="Search program"
          className={classes.selectField}
          select
          value={selectedSearchProgram}
          onChange={event => {
            const program = event.target.value as SearchProgram
            setSelectedSearchProgram(program)
            // the two services name their databases differently, so the current
            // selection is meaningless to the other one
            setSelectedDatabase(defaultDatabaseFor(program))
          }}
        >
          {searchPrograms.map(val => (
            <MenuItem value={val} key={val}>
              {val}
            </MenuItem>
          ))}
        </TextField2>

        <TextField2
          variant="outlined"
          label="Database"
          className={classes.selectField}
          select
          value={selectedDatabase}
          onChange={event => {
            setSelectedDatabase(event.target.value as BlastDatabase)
          }}
        >
          {databaseOptionsFor(selectedSearchProgram).map(val => (
            <MenuItem value={val} key={val}>
              {val}
            </MenuItem>
          ))}
        </TextField2>

        {isPhmmer ? null : (
          <MsaAlgorithmSelect
            className={classes.selectField}
            value={selectedMsaAlgorithm}
            onChange={setSelectedMsaAlgorithm}
          />
        )}

        <TranscriptSelector feature={feature} {...transcriptSelection} />

        <Typography className={classes.infoText}>
          {isPhmmer
            ? `phmmer searches UniProtKB with a profile HMM built from the query,
               so it aligns the hits as it finds them and that alignment is used
               directly — nothing is realigned afterwards. The tree is then built
               from it by neighbour-joining. A hit matching the query in more
               than one place appears once per matched region.`
            : `This panel will automatically submit a blastp query to EBI, which
               searches UniProtKB. Searches usually finish in under a minute, and
               swissprot returns curated sequences that align more cleanly than
               the many near-identical entries a TrEMBL search brings back. After
               completion, all the hits will be run through a multiple sequence
               alignment.`}{' '}
          Searching NCBI's nr needs the manual approach: NCBI no longer lets a
          browser read responses from Blast.cgi.
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
                  blastDatabase: selectedDatabase,
                  searchProgram: selectedSearchProgram,
                  msaAlgorithm: isPhmmer ? undefined : selectedMsaAlgorithm,
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
