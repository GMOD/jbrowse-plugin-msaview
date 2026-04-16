import React, { useEffect, useMemo, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import CachedBlastResults from './CachedBlastResults'
import { blastLaunchView } from './blastLaunchView'
import { msaAlgorithms } from './consts'
import TextField2 from '../../../components/TextField2'
import { getAllCachedResults } from '../../../utils/blastCache'
import {
  getGeneDisplayName,
  getGeneIdentifiers,
  getTranscriptDisplayName,
} from '../../util'
import TranscriptSelector from '../TranscriptSelector'
import { useTranscriptSelection } from '../useTranscriptSelection'

import type { MsaAlgorithm } from './consts'
import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  selectField: {
    width: 150,
  },
  databaseFieldContainer: {
    display: 'flex',
  },
  clusterSeqMessage: {
    marginLeft: 4,
    alignContent: 'center',
  },
  cachedResultsAccordion: {
    marginTop: 20,
  },
  infoText: {
    marginTop: 20,
  },
})

const blastDatabaseOptions = ['nr', 'nr_cluster_seq'] as const
const blastPrograms = ['blastp', 'quick-blastp'] as const

type blastDatabaseOptionsT = (typeof blastDatabaseOptions)[number]
type blastProgramsT = (typeof blastPrograms)[number]

const NCBIBlastAutomaticPanel = observer(function ({
  handleClose,
  feature,
  model,
  children,
  baseUrl,
}: {
  model: AbstractTrackModel
  feature: Feature
  baseUrl: string
  handleClose: () => void
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearGenomeViewModel
  const [launchViewError, setLaunchViewError] = useState<unknown>()
  const [selectedBlastDatabase, setSelectedBlastDatabase] =
    useState<blastDatabaseOptionsT>('nr')
  const [selectedMsaAlgorithm, setSelectedMsaAlgorithm] =
    useState<MsaAlgorithm>('clustalo')
  const [selectedBlastProgram, setSelectedBlastProgram] =
    useState<blastProgramsT>('quick-blastp')
  const [hasCachedResults, setHasCachedResults] = useState(false)
  const [error, setError] = useState<unknown>()

  const geneIds = useMemo(() => getGeneIdentifiers(feature), [feature])
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const results = await getAllCachedResults()
        setHasCachedResults(
          results.some(r => r.geneId && geneIds.includes(r.geneId)),
        )
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [geneIds])

  const {
    options,
    selectedId,
    setSelectedId,
    selectedTranscript,
    proteinSequence,
    error: proteinSequenceError,
  } = useTranscriptSelection({ feature, view })
  const e = proteinSequenceError ?? launchViewError ?? error
  return (
    <>
      <DialogContent className={classes.dialogContent}>
        {children}
        {e ? <ErrorMessage error={e} /> : null}
        <TextField2
          variant="outlined"
          label="BLAST database"
          className={classes.selectField}
          select
          value={selectedBlastDatabase}
          onChange={event => {
            const newDb = event.target
              .value as (typeof blastDatabaseOptions)[number]
            setSelectedBlastDatabase(newDb)
            if (newDb === 'nr_cluster_seq') {
              setSelectedBlastProgram('blastp')
            }
          }}
        >
          {blastDatabaseOptions.map(val => (
            <MenuItem value={val} key={val}>
              {val}
            </MenuItem>
          ))}
        </TextField2>

        <TextField2
          variant="outlined"
          label="MSA Algorithm"
          className={classes.selectField}
          select
          value={selectedMsaAlgorithm}
          onChange={event => {
            setSelectedMsaAlgorithm(event.target.value as MsaAlgorithm)
          }}
        >
          {msaAlgorithms.map(val => (
            <MenuItem value={val} key={val}>
              {val}
            </MenuItem>
          ))}
        </TextField2>

        <div className={classes.databaseFieldContainer}>
          <TextField2
            variant="outlined"
            label="BLAST program"
            disabled={selectedBlastDatabase === 'nr_cluster_seq'}
            className={classes.selectField}
            select
            value={selectedBlastProgram}
            onChange={event => {
              setSelectedBlastProgram(
                event.target.value as (typeof blastPrograms)[number],
              )
            }}
          >
            {blastPrograms.map(val => (
              <MenuItem value={val} key={val}>
                {val}
              </MenuItem>
            ))}
          </TextField2>
          {selectedBlastDatabase === 'nr_cluster_seq' ? (
            <Typography
              variant="subtitle2"
              className={classes.clusterSeqMessage}
            >
              Can only use blastp on nr_cluster_seq
            </Typography>
          ) : null}
        </div>

        <TranscriptSelector
          feature={feature}
          options={options}
          selectedId={selectedId}
          selectedTranscript={selectedTranscript}
          onTranscriptChange={setSelectedId}
          proteinSequence={proteinSequence}
        />

        <Typography className={classes.infoText}>
          This panel will automatically submit a query to NCBI. Using blastp can
          take 10+ minutes to run, quick-blastp is generally a lot faster but is
          not available for the clustered database. After completion, all the
          hits will be run through a multiple sequence alignment. Note: we are
          not able to currently run NCBI COBALT automatically on the BLAST
          results, even though that is the method NCBI uses on their website. If
          you need a COBALT alignment, please use the manual approach of
          submitting BLAST yourself and downloading the resulting files
        </Typography>

        {hasCachedResults ? (
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
      </DialogContent>
      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            try {
              if (!selectedTranscript) {
                return
              }
              setLaunchViewError(undefined)
              blastLaunchView({
                feature: selectedTranscript,
                view,
                newViewTitle: `BLAST - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)}`,
                blastParams: {
                  baseUrl,
                  blastProgram: selectedBlastProgram,
                  blastDatabase: selectedBlastDatabase,
                  msaAlgorithm: selectedMsaAlgorithm,
                  selectedTranscript,
                  proteinSequence,
                },
              })
            } catch (e) {
              console.error(e)
              setLaunchViewError(e)
            }

            handleClose()
          }}
          disabled={!proteinSequence}
        >
          Submit
        </Button>
        <Button color="secondary" variant="contained" onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default NCBIBlastAutomaticPanel
