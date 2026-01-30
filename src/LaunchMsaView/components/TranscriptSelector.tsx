import React, { useState } from 'react'

import { Feature } from '@jbrowse/core/util'
import { Button, MenuItem, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import ReadOnlyTextField2 from '../../components/ReadOnlyTextField2'
import {
  featureMatchesId,
  getGeneDisplayName,
  getId,
  getTranscriptDisplayName,
  getTranscriptLength,
} from '../util'

const useStyles = makeStyles()({
  flex: {
    display: 'flex',
  },
  minWidth: {
    minWidth: 300,
  },
})

export default function TranscriptSelector({
  feature,
  options,
  selectedId,
  selectedTranscript,
  onTranscriptChange,
  proteinSequence,
  validSet,
}: {
  feature: Feature
  options: Feature[]
  selectedId: string
  selectedTranscript: Feature | undefined
  onTranscriptChange: (transcriptId: string) => void
  proteinSequence: string | undefined
  validSet?: Set<string>
}) {
  const { classes } = useStyles()
  const [showSequence, setShowSequence] = useState(false)

  return (
    <>
      <div className={classes.flex}>
        <TextField
          variant="outlined"
          label={`Choose isoform of ${getGeneDisplayName(feature)}`}
          select
          className={classes.minWidth}
          value={selectedId}
          onChange={event => {
            onTranscriptChange(event.target.value)
          }}
        >
          {options.map(val => {
            const inSet = validSet
              ? [...validSet].some(id => featureMatchesId(val, id))
              : true
            const { len, mod } = getTranscriptLength(val)
            return (
              <MenuItem value={getId(val)} key={val.id()} disabled={!inSet}>
                {getTranscriptDisplayName(val)} ({len} aa){' '}
                {mod ? ` (possible fragment)` : ''}
                {validSet ? (inSet ? ' (has data)' : ' (no data)') : ''}
              </MenuItem>
            )
          })}
        </TextField>
        <div style={{ alignContent: 'center', marginLeft: 20 }}>
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

      {showSequence && (
        <ReadOnlyTextField2
          value={
            proteinSequence
              ? `>${getTranscriptDisplayName(selectedTranscript)}\n${proteinSequence}`
              : 'Loading...'
          }
        />
      )}
    </>
  )
}
