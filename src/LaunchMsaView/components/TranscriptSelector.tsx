import React, { useState } from 'react'

import { Button, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import ReadOnlyTextField2 from '../../components/ReadOnlyTextField2'
import {
  getGeneDisplayName,
  getId,
  getTranscriptDisplayName,
  getTranscriptLength,
} from '../util'

import type { SequenceStatus } from './SequenceStatus'
import type { Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  flex: {
    display: 'flex',
  },
  minWidth: {
    minWidth: 300,
  },
  centered: {
    alignContent: 'center',
    marginLeft: 20,
  },
})

const TranscriptSelector = observer(function TranscriptSelector({
  feature,
  options,
  selectedId,
  selectedTranscript,
  setSelectedId,
  proteinSequence,
  sequenceStatus = 'ready',
  hasData,
}: {
  feature: Feature
  options: Feature[]
  selectedId: string
  selectedTranscript: Feature | undefined
  setSelectedId: (transcriptId: string) => void
  proteinSequence: string | undefined
  sequenceStatus?: SequenceStatus
  hasData?: (transcript: Feature) => boolean
}) {
  const { classes } = useStyles()
  const [showSequence, setShowSequence] = useState(false)

  return (
    <>
      <div className={classes.flex}>
        <TextField
          variant="outlined"
          label={`Choose isoform of ${getGeneDisplayName(feature)}`}
          // The query row is this transcript rather than NCBI's representative
          // protein, which is what keeps the alignment linked to the genome view
          // at codon resolution. It used to be a paragraph under the panel; as
          // helper text it says the same thing where the choice is made and
          // costs no height of its own.
          helperText="the query row, so the alignment stays linked to the genome view"
          select
          className={classes.minWidth}
          value={selectedId}
          onChange={event => {
            setSelectedId(event.target.value)
          }}
        >
          {options.map(val => {
            const inSet = hasData ? hasData(val) : true
            const { len, mod } = getTranscriptLength(val)
            return (
              <MenuItem value={getId(val)} key={val.id()} disabled={!inSet}>
                {getTranscriptDisplayName(val)} ({len} aa){' '}
                {mod ? ` (possible fragment)` : ''}
                {hasData ? (inSet ? ' (has data)' : ' (no data)') : ''}
              </MenuItem>
            )
          })}
        </TextField>
        <div className={classes.centered}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setShowSequence(!showSequence)
            }}
          >
            {showSequence ? 'Hide sequence' : 'Show sequence'}
          </Button>
        </div>
      </div>

      {showSequence ? (
        <ReadOnlyTextField2
          value={
            proteinSequence
              ? `>${getTranscriptDisplayName(selectedTranscript)}\n${proteinSequence}`
              : sequenceStatus === 'missing'
                ? 'This transcript has no coding sequence, so there is nothing to translate.'
                : sequenceStatus === 'error'
                  ? 'The sequence could not be fetched.'
                  : 'Loading...'
          }
        />
      ) : null}
    </>
  )
})

export default TranscriptSelector
