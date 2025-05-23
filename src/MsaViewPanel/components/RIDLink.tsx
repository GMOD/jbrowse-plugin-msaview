import React from 'react'

import { Typography } from '@mui/material'

import ExternalLink from '../../ExternalLink'
import { BLAST_URL } from '../../utils/ncbiBlast'

function RIDLink({ rid }: { rid: string }) {
  return (
    <Typography>
      RID {rid} (
      <ExternalLink href={`${BLAST_URL}?CMD=Get&RID=${rid}`}>
        see status at NCBI
      </ExternalLink>
      )
    </Typography>
  )
}

export default RIDLink
