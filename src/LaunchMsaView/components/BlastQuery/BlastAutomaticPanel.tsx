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
import CachedBlastResults from './CachedBlastResults'
import MsaAlgorithmSelect from './MsaAlgorithmSelect'
import { blastLaunchView } from './blastLaunchView'
import {
  databaseOptionsFor,
  defaultBlastDatabase,
  defaultSearchFor,
  searchPrograms,
} from './consts'
import { useCachedBlastResults } from './useCachedBlastResults'

import type { MsaAlgorithm, SearchChoice, SearchProgram } from './consts'
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
  // one piece of state, not two: a program and a database that program does not
  // have is a 400 from EBI minutes after Submit, and holding them apart is what
  // would let them drift into that
  const [search, setSearch] = useState<SearchChoice>({
    program: 'blastp',
    database: defaultBlastDatabase,
  })
  const [selectedMsaAlgorithm, setSelectedMsaAlgorithm] =
    useState<MsaAlgorithm>('clustalo')
  const isPhmmer = search.program === 'phmmer'

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
          value={search.program}
          onChange={event => {
            // the two services name their databases differently, so switching
            // program replaces the database rather than keeping a name the new
            // one has never heard of
            setSearch(defaultSearchFor(event.target.value as SearchProgram))
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
          value={search.database}
          onChange={event => {
            setSearch({
              program: search.program,
              database: event.target.value,
            } as SearchChoice)
          }}
        >
          {databaseOptionsFor(search.program).map(val => (
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
        model={model}
        submitDisabled={!proteinSequence}
        onSubmit={() => {
          try {
            if (selectedTranscript) {
              setLaunchViewError(undefined)
              blastLaunchView({
                feature: selectedTranscript,
                view,
                newViewTitle: getBlastViewTitle(feature, selectedTranscript),
                blastParams:
                  search.program === 'phmmer'
                    ? {
                        searchProgram: 'phmmer',
                        blastDatabase: search.database,
                        selectedTranscript,
                        proteinSequence,
                      }
                    : {
                        searchProgram: 'blastp',
                        blastDatabase: search.database,
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
