import React from 'react'

import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material'

export default function NCBIBlastMethodSelector({
  lookupMethod,
  setLookupMethod,
}: {
  lookupMethod: string
  setLookupMethod: (method: string) => void
}) {
  return (
    <FormControl component="fieldset">
      <RadioGroup
        row
        value={lookupMethod}
        onChange={event => {
          setLookupMethod(event.target.value)
        }}
      >
        <FormControlLabel
          value="automatic"
          control={<Radio />}
          label="Run NCBI BLAST and load results automatically"
        />
        <FormControlLabel
          value="manual"
          control={<Radio />}
          label="Link to NCBI BLAST and import results manually"
        />
      </RadioGroup>
    </FormControl>
  )
}
