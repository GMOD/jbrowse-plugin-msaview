import React, { Suspense, lazy, useState } from 'react'

import Help from '@mui/icons-material/Help'
import { IconButton, Tooltip } from '@mui/material'

const HelpDialog = lazy(() => import('./HelpDialog'))

export default function HelpButton() {
  const [show, setShow] = useState(false)
  return (
    <>
      <Tooltip title="What each tab does">
        <IconButton
          aria-label="Help"
          onClick={() => {
            setShow(true)
          }}
        >
          <Help />
        </IconButton>
      </Tooltip>
      {show ? (
        <Suspense fallback={null}>
          <HelpDialog
            handleClose={() => {
              setShow(false)
            }}
          />
        </Suspense>
      ) : null}
    </>
  )
}
