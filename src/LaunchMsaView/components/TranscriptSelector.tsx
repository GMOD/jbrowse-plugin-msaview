import React, { useState } from 'react'

import { Feature } from '@jbrowse/core/util'
import { Box, Button, MenuItem, TextField } from '@mui/material'

import {
  getGeneDisplayName,
  getId,
  getTranscriptDisplayName,
  getTranscriptLength,
} from '../util'

function TranscriptMenuItem({
  val,
  validSet,
}: {
  val: Feature
  validSet?: Set<string>
}) {
  const inSet = validSet ? validSet.has(getId(val)) : true
  const { len, mod } = getTranscriptLength(val)
  return (
    <MenuItem value={getId(val)} key={val.id()} disabled={!inSet}>
      {getTranscriptDisplayName(val)} ({len} aa){' '}
      {mod ? ` (possible fragment)` : ''}
      {validSet ? (inSet ? ' (has data)' : ' (no data)') : ''}
    </MenuItem>
  )
}

export default function TranscriptSelector({
  feature,
  options,
  selectedTranscriptId,
  onTranscriptChange,
  proteinSequence,
  validSet,
}: {
  feature: Feature
  options: Feature[]
  selectedTranscriptId: string
  onTranscriptChange: (transcriptId: string) => void
  proteinSequence: string | undefined
  validSet?: Set<string>
}) {
  const [showSequence, setShowSequence] = useState(false)
  const selectedTranscript = options.find(
    val => getId(val) === selectedTranscriptId,
  )

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          variant="outlined"
          label={`Choose isoform of ${getGeneDisplayName(feature)}`}
          select
          sx={{ minWidth: 300 }}
          value={selectedTranscriptId}
          onChange={event => {
            onTranscriptChange(event.target.value)
          }}
        >
          {[...options]
            .toSorted(
              (a, b) => getTranscriptLength(b).len - getTranscriptLength(a).len,
            )
            .map(val => (
              <TranscriptMenuItem
                key={val.id()}
                val={val}
                validSet={validSet}
              />
            ))}
        </TextField>
        <Box sx={{ marginLeft: 2.5 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setShowSequence(!showSequence)
            }}
          >
            {showSequence ? 'Hide sequence' : 'Show sequence'}
          </Button>
        </Box>
      </Box>

      {showSequence && selectedTranscript && (
        <TextField
          variant="outlined"
          multiline
          minRows={5}
          maxRows={10}
          fullWidth
          value={
            proteinSequence
              ? `>${getTranscriptDisplayName(
                  selectedTranscript,
                )}\n${proteinSequence}`
              : 'Loading...'
          }
          slotProps={{
            input: { readOnly: true },
          }}
          sx={{
            '.MuiInputBase-input': {
              fontFamily: 'Courier New',
            },
          }}
        />
      )}
    </>
  )
}
