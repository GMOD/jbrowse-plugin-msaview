import React from 'react'
import { Link } from '@mui/material'
// locals
import OpenInNewIcon from '../../LaunchMsaView/components/NewNCBIBlastQuery/OpenInNewIcon'
import { BLAST_URL } from '../../LaunchMsaView/components/NewNCBIBlastQuery/ncbiBlastUtils'

function RIDLink({ rid }: { rid: string }) {
  return (
    <>
      RID {rid}{' '}
      <Link target="_black" href={`${BLAST_URL}?CMD=Get&RID=${rid}`}>
        (see status at NCBI <OpenInNewIcon />)
      </Link>
    </>
  )
}

export default RIDLink
