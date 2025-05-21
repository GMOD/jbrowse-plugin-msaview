import React, { useState } from 'react'
import {
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  MenuItem,
  Typography,
} from '@mui/material'
import TextField2 from '../../../TextField2'

interface BlastOptionsProps {
  blastDatabase: string
  setBlastDatabase: (value: string) => void
  msaAlgorithm: string
  setMsaAlgorithm: (value: string) => void
  geneTreeId: string
  setGeneTreeId: (value: string) => void
  featureId?: string
}

const BlastOptions = ({
  blastDatabase,
  setBlastDatabase,
  msaAlgorithm,
  setMsaAlgorithm,
  geneTreeId,
  setGeneTreeId,
  featureId,
}: BlastOptionsProps) => {
  const [entryMode, setEntryMode] = useState<'auto' | 'manual'>(
    featureId ? 'auto' : 'manual'
  )

  // Update geneTreeId when entry mode changes
  React.useEffect(() => {
    if (entryMode === 'auto' && featureId) {
      setGeneTreeId(featureId)
    }
  }, [entryMode, featureId, setGeneTreeId])

  const blastDatabaseOptions = ['nr', 'nr_cluster_seq']
  const msaAlgorithms = ['clustalo', 'muscle', 'kalign', 'mafft']

  return (
    <>
      <Typography variant="h6" style={{ marginTop: '16px', marginBottom: '8px' }}>
        BLAST Options
      </Typography>
      
      <TextField2
        label="BLAST database"
        select
        value={blastDatabase}
        onChange={event => {
          setBlastDatabase(event.target.value)
        }}
        style={{ marginBottom: '16px' }}
      >
        {blastDatabaseOptions.map(val => (
          <MenuItem value={val} key={val}>
            {val}
          </MenuItem>
        ))}
      </TextField2>

      <TextField2
        label="MSA Algorithm"
        select
        value={msaAlgorithm}
        onChange={event => {
          setMsaAlgorithm(event.target.value)
        }}
        style={{ marginBottom: '16px' }}
      >
        {msaAlgorithms.map(val => (
          <MenuItem value={val} key={val}>
            {val}
          </MenuItem>
        ))}
      </TextField2>

      {featureId && (
        <FormControl component="fieldset" style={{ marginBottom: '16px' }}>
          <Typography variant="subtitle1">Gene Tree ID</Typography>
          <RadioGroup
            row
            value={entryMode}
            onChange={e => setEntryMode(e.target.value as 'auto' | 'manual')}
          >
            <FormControlLabel
              value="auto"
              control={<Radio />}
              label="Auto (use feature ID)"
            />
            <FormControlLabel
              value="manual"
              control={<Radio />}
              label="Manual entry"
            />
          </RadioGroup>

          {entryMode === 'manual' && (
            <TextField2
              label="Gene Tree ID"
              variant="outlined"
              fullWidth
              value={geneTreeId}
              onChange={e => setGeneTreeId(e.target.value)}
              style={{ marginTop: '8px' }}
            />
          )}

          {entryMode === 'auto' && (
            <Typography variant="body2" style={{ marginTop: '8px' }}>
              Using feature ID: {featureId || 'No ID available'}
            </Typography>
          )}
        </FormControl>
      )}
    </>
  )
}

export default BlastOptions
