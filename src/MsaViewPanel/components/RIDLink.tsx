import React from 'react'

import { Typography } from '@mui/material'

import ExternalLink from '../../components/ExternalLink'

function RIDLink({ baseUrl, rid }: { rid: string; baseUrl: string }) {
  return (
    <Typography>
      RID {rid} (
      <ExternalLink href={`${baseUrl}?CMD=Get&RID=${rid}`}>
        see status
      </ExternalLink>
      )
    </Typography>
  )
}

export default RIDLink
