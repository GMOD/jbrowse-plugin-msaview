import React from 'react'

import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material'

import type { BlastLookupMethod } from './NCBIBlastPanel'

export default function NCBIBlastMethodSelector({
  lookupMethod,
  setLookupMethod,
}: {
  lookupMethod: BlastLookupMethod
  setLookupMethod: (method: BlastLookupMethod) => void
}) {
  return (
    <FormControl component="fieldset">
      <RadioGroup
        row
        value={lookupMethod}
        onChange={event => {
          setLookupMethod(event.target.value as BlastLookupMethod)
        }}
      >
        <FormControlLabel
          value="automatic"
          control={<Radio />}
          label="Automatic"
        />
        <FormControlLabel
          value="rid"
          control={<Radio />}
          label="Load from RID"
        />
        <FormControlLabel value="manual" control={<Radio />} label="Manual" />
      </RadioGroup>
    </FormControl>
  )
}
