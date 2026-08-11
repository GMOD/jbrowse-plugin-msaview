import React from 'react'

import { Typography } from '@mui/material'

import ExternalLink from '../../components/ExternalLink'
import { ebiBlastResultUrl } from '../../utils/ebiBlast'

function JobLink({ jobId }: { jobId: string }) {
  return (
    <Typography>
      Job {jobId} (
      <ExternalLink href={ebiBlastResultUrl(jobId)}>see status</ExternalLink>)
    </Typography>
  )
}

export default JobLink
