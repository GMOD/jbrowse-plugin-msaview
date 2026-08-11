import React from 'react'

import { Typography } from '@mui/material'

import ExternalLink from '../../components/ExternalLink'
import { ebiBlastResultUrl } from '../../utils/ebiBlast'

import type { BlastService } from '../../LaunchMsaView/components/NCBIBlastQuery/consts'

function RIDLink({
  baseUrl,
  rid,
  blastService = 'ncbi',
}: {
  rid: string
  baseUrl: string
  blastService?: BlastService
}) {
  const isEbi = blastService === 'ebi'
  return (
    <Typography>
      {isEbi ? 'Job' : 'RID'} {rid} (
      <ExternalLink
        href={isEbi ? ebiBlastResultUrl(rid) : `${baseUrl}?CMD=Get&RID=${rid}`}
      >
        see status
      </ExternalLink>
      )
    </Typography>
  )
}

export default RIDLink
