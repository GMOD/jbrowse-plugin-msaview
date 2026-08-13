import React from 'react'

import { Typography } from '@mui/material'

import ExternalLink from '../../components/ExternalLink'
import { ebiBlastResultUrl } from '../../utils/ebiBlast'
import { isPhmmerJobId, phmmerResultUrl } from '../../utils/phmmer'

function JobLink({ jobId }: { jobId: string }) {
  // read off the job id rather than the launch params, so a link rebuilt for an
  // old cached job still points at the tool that actually ran it
  const url = isPhmmerJobId(jobId)
    ? phmmerResultUrl(jobId)
    : ebiBlastResultUrl(jobId)
  return (
    <Typography>
      Job {jobId} (<ExternalLink href={url}>see status</ExternalLink>)
    </Typography>
  )
}

export default JobLink
