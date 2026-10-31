import React from 'react'

import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material'
import { observer } from 'mobx-react'

import type { BlastLookupMethod } from './BlastPanel'

const BlastMethodSelector = observer(function BlastMethodSelector({
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
        <FormControlLabel value="manual" control={<Radio />} label="Manual" />
      </RadioGroup>
    </FormControl>
  )
})

export default BlastMethodSelector
