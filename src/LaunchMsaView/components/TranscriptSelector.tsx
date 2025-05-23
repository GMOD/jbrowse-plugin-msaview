import React, { useState } from 'react'

import { Feature } from '@jbrowse/core/util'
import { Button, MenuItem } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import TextField2 from '../../TextField2'
import {
  getGeneDisplayName2,
  getId,
  getTranscriptDisplayName,
  getTranscriptLength,
} from '../util'

const useStyles = makeStyles()({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

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
  const { classes } = useStyles()
  const [showSequence, setShowSequence] = useState(false)
  const selectedTranscript = options.find(
    val => getId(val) === selectedTranscriptId,
  )!

  return (
    <>
      <div style={{ display: 'inline' }}>
        <TextField2
          variant="outlined"
          label={`Choose isoform of ${getGeneDisplayName2(feature)}`}
          select
          style={{ minWidth: 300 }}
          value={selectedTranscriptId}
          onChange={event => {
            onTranscriptChange(event.target.value)
          }}
        >
          {options
            .toSorted(
              (a, b) => getTranscriptLength(b).len - getTranscriptLength(a).len,
            )
            .map(val => {
              const inSet = validSet ? validSet.has(getId(val)) : true
              const { len, mod } = getTranscriptLength(val)
              return (
                <MenuItem value={getId(val)} key={val.id()} disabled={!inSet}>
                  {getTranscriptDisplayName(val)} ({len} aa){' '}
                  {mod ? ` (possible fragment)` : ''}
                  {validSet ? (inSet ? '' : ' (no data)') : ''}
                </MenuItem>
              )
            })}
        </TextField2>
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
        <TextField2
          variant="outlined"
          multiline
          minRows={5}
          maxRows={10}
          fullWidth
          value={
            proteinSequence
              ? `>${getTranscriptDisplayName(selectedTranscript)}\n${proteinSequence}`
              : 'Loading...'
          }
          slotProps={{
            input: {
              readOnly: true,
              classes: {
                input: classes.textAreaFont,
              },
            },
          }}
        />
      )}
    </>
  )
}
