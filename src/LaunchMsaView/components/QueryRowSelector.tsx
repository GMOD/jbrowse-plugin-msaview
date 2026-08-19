import React from 'react'

import { Alert, MenuItem } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import TextField2 from '../../components/TextField2'

import type { QueryRowMatch } from '../detectQueryRow'

const useStyles = makeStyles()({
  field: {
    marginTop: 20,
  },
  alert: {
    marginTop: 10,
  },
})

/**
 * Which MSA row corresponds to the selected transcript. Clicking and hovering in
 * the alignment reach the genome only through this name, and a wrong one fails
 * silently -- the view opens, renders, and never navigates -- so the field fills
 * itself in from the pasted alignment and offers that alignment's own row names
 * rather than a free text box the user can typo.
 */
export default function QueryRowSelector({
  names,
  detected,
  querySeqName,
  setQuerySeqName,
  isAutoDetected,
}: {
  names: string[]
  detected?: QueryRowMatch
  querySeqName: string
  setQuerySeqName: (arg: string) => void
  isAutoDetected: boolean
}) {
  const { classes } = useStyles()

  return (
    <>
      {names.length > 0 ? (
        <TextField2
          variant="outlined"
          label="MSA row matching the selected transcript"
          select
          fullWidth
          className={classes.field}
          value={names.includes(querySeqName) ? querySeqName : ''}
          onChange={event => {
            setQuerySeqName(event.target.value)
          }}
        >
          {names.map(name => (
            <MenuItem value={name} key={name}>
              {name}
              {detected?.name === name ? ' — matches your protein' : ''}
            </MenuItem>
          ))}
        </TextField2>
      ) : (
        <TextField2
          variant="outlined"
          label="MSA row matching the selected transcript"
          fullWidth
          className={classes.field}
          helperText="Paste an alignment above and this fills in on its own"
          value={querySeqName}
          onChange={event => {
            setQuerySeqName(event.target.value)
          }}
        />
      )}

      {isAutoDetected && detected ? (
        <Alert severity="success" className={classes.alert}>
          Matched <strong>{detected.name}</strong> to your protein sequence
          {detected.quality === 'exact'
            ? ''
            : `, covering ${Math.round(detected.identity * 100)}% of it`}
          . Clicking the alignment will navigate the genome view.
        </Alert>
      ) : names.length > 0 && !querySeqName ? (
        <Alert severity="warning" className={classes.alert}>
          No row matched your protein sequence — pick the one for your gene
          above. Without it the alignment still renders, but clicking it will
          not navigate the genome view.
        </Alert>
      ) : null}
    </>
  )
}
