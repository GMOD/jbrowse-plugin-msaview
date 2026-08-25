import React from 'react'

import { MenuItem } from '@mui/material'

import TextField2 from '../../../components/TextField2'

import type { OrthologSource } from '../../../MsaViewPanel/model'

export const ORTHOLOG_SOURCE_STORAGE_KEY = 'msaview-ortholog-source'

export const orthologSourceLabels: Record<OrthologSource, string> = {
  ncbi: 'NCBI orthologs',
  panther: 'PANTHER',
}

// Which species a source can answer for, in the words a reader picking one
// needs: NCBI's ortholog sets stop at vertebrates and insects, PANTHER's run
// from human to yeast and Arabidopsis.
const hints: Record<OrthologSource, string> = {
  ncbi: 'vertebrates and insects',
  panther: 'also yeast, worm, fly and plants',
}

export default function OrthologSourceSelect({
  value,
  onChange,
  className,
}: {
  value: OrthologSource
  onChange: (val: OrthologSource) => void
  className?: string
}) {
  return (
    <TextField2
      variant="outlined"
      label="Source"
      className={className}
      select
      value={value}
      helperText={hints[value]}
      onChange={event => {
        onChange(event.target.value as OrthologSource)
      }}
    >
      {(Object.keys(orthologSourceLabels) as OrthologSource[]).map(val => (
        <MenuItem value={val} key={val}>
          {orthologSourceLabels[val]}
        </MenuItem>
      ))}
    </TextField2>
  )
}
