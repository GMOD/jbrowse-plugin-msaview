import React from 'react'

import { Typography } from '@mui/material'

import { BLAST_URL } from '../../utils/ncbiBlast'
import ExternalLink from '../../ExternalLink'

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
