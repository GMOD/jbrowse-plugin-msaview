import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogActions,
  DialogContent,
  Link,
  MenuItem,
  TextField,
  TextFieldProps,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { ErrorMessage } from '@jbrowse/core/ui'
import {
  AbstractTrackModel,
  Feature,
  SimpleFeatureSerialized,
  getContainingView,
  getSession,
  useLocalStorage,
} from '@jbrowse/core/util'

import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { BLAST_URL, queryBlast } from './ncbiBlastUtils'
import { ncbiBlastLaunchView } from './ncbiBlastLaunchView'
import { useFeatureSequence } from './useFeatureSequence'
import {
  getId,
  getTranscriptDisplayName,
  getTranscriptFeatures,
  getGeneDisplayName,
} from '../../util'
import { getProteinSequence } from './calculateProteinSequence'
import OpenInNewIcon from './OpenInNewIcon'
import { launchMSA } from './msaUtils'
import { makeId, strip } from './util'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

function TextField2({ children, ...rest }: TextFieldProps) {
  return (
    <div>
      <TextField {...rest}>{children}</TextField>
    </div>
  )
}

interface PreviousBLASTQueries {
  rid: string
  transcript: SimpleFeatureSerialized
  data: {
    msa: string
    tree: string
  }
}

function RIDLink({ rid }: { rid: string }) {
  return (
    <>
      RID {rid}{' '}
      <Link target="_black" href={`${BLAST_URL}?CMD=Get&RID=${rid}`}>
        (see status at NCBI <OpenInNewIcon />)
      </Link>
    </>
  )
}

const NcbiBlastPanel = observer(function ({
  handleClose,
  feature,
  model,
}: {
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const [error, setError] = useState<unknown>()
  const [rid, setRid] = useState<string>()
  const [progress, setProgress] = useState('')
  const [database, setDatabase] = useState('nr_cluster_seq')
  const [processing, setProcessing] = useState(false)
  const [msaAlgorithm, setMsaAlgorithm] = useState('clustalo')
  const [previousQueries, setPreviousQueries] = useLocalStorage(
    'previous-blast-queries',
    [] as PreviousBLASTQueries[],
  )
  const program = 'blastp'

  const options = getTranscriptFeatures(feature)
  const [userSelection, setUserSelection] = useState(getId(options[0]))
  const selectedTranscript = options.find(val => getId(val) === userSelection)!
  const { sequence, error: error2 } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })
  const protein =
    sequence && !('error' in sequence)
      ? getProteinSequence({
          seq: sequence.seq,
          selectedTranscript,
        })
      : ''

  const e = error || error2
  const databaseOptions = ['nr', 'nr_cluster_seq']
  const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft']
  return (
    <DialogContent className={classes.dialogContent}>
      {e ? (
        <div>
          {rid ? <RIDLink rid={rid} /> : null}
          <ErrorMessage error={e} />
        </div>
      ) : rid ? (
        <Typography>
          {rid ? (
            <>
              <RIDLink rid={rid} />.{' '}
            </>
          ) : null}
          {progress}
        </Typography>
      ) : null}

      <TextField2
        value={database}
        onChange={event => setDatabase(event.target.value)}
        label="BLAST database"
        select
      >
        {databaseOptions.map(val => (
          <MenuItem value={val} key={val}>
            {val}
          </MenuItem>
        ))}
      </TextField2>

      <TextField2
        value={msaAlgorithm}
        onChange={event => setMsaAlgorithm(event.target.value)}
        label="MSA Algorithm"
        select
      >
        {msaAlgorithms.map(val => (
          <MenuItem value={val} key={val}>
            {val}
          </MenuItem>
        ))}
      </TextField2>

      <TextField2
        value={userSelection}
        onChange={event => setUserSelection(event.target.value)}
        label="Choose isoform to BLAST"
        select
      >
        {options.map(val => (
          <MenuItem value={getId(val)} key={val.id()}>
            {getGeneDisplayName(feature)} - {getTranscriptDisplayName(val)}
          </MenuItem>
        ))}
      </TextField2>
      <TextField2
        variant="outlined"
        multiline
        minRows={5}
        maxRows={10}
        fullWidth
        value={
          !protein
            ? 'Loading...'
            : `>${getTranscriptDisplayName(selectedTranscript)}\n${protein}`
        }
        InputProps={{
          readOnly: true,
          classes: {
            input: classes.textAreaFont,
          },
        }}
      />

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                setProcessing(true)
                setError(undefined)
                setProgress('Submitting query')
                const query = protein.replaceAll('*', '').replaceAll('&', '')
                const { rid, hits } = await queryBlast({
                  query,
                  database,
                  program,
                  onProgress: arg => setProgress(arg),
                  onRid: rid => setRid(rid),
                })

                const sequence = [
                  `>QUERY\n${query}`,
                  ...hits
                    .map(
                      h =>
                        [
                          makeId(h.description[0]),
                          strip(h.hsps[0].hseq),
                        ] as const,
                    )
                    .map(([id, seq]) => `>${id}\n${seq}`),
                ].join('\n')

                const data = await launchMSA({
                  algorithm: msaAlgorithm,
                  sequence,
                  onProgress: arg => setProgress(arg),
                })

                await ncbiBlastLaunchView({
                  session,
                  feature: selectedTranscript,
                  view,
                  newViewTitle: `NCBI BLAST - ${getGeneDisplayName(feature)} - ${getTranscriptDisplayName(selectedTranscript)} - ${msaAlgorithm}`,
                  data,
                })

                setPreviousQueries([
                  {
                    transcript: selectedTranscript.toJSON(),
                    rid,
                    data,
                  },
                  ...previousQueries,
                ])
                handleClose()
              } catch (e) {
                console.error(e)
                setProcessing(false)
                setError(e)
              }
            })()
          }}
          disabled={!protein || processing}
        >
          Submit
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
      </DialogActions>
    </DialogContent>
  )
})

export default NcbiBlastPanel
