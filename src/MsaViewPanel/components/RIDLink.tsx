import React from 'react'

import { Link, Typography } from '@mui/material'

import OpenInNewIcon from '../../OpenInNewIcon'
import { BLAST_URL } from '../../utils/ncbiBlast'

function RIDLink({ rid }: { rid: string }) {
  return (
    <Typography>
      RID {rid}{' '}
      <Link target="_black" href={`${BLAST_URL}?CMD=Get&RID=${rid}`}>
        (see status at NCBI <OpenInNewIcon />)
      </Link>
    </Typography>
  )
}

export default RIDLink
