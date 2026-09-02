import React from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import JobLink from './JobLink'

import type { JBrowsePluginMsaViewModel } from '../model'

const useStyles = makeStyles()({
  margin: {
    padding: 20,
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
})

/**
 * What a view shows while it is still building its alignment, and what it shows
 * when that fails.
 *
 * Every launch that resolves something leaves its request on the model until it
 * succeeds -- `blastParams`, `orthologParams`, `init` -- so one still being
 * there IS "no alignment yet", and the error a failed launch records is only
 * readable here. This used to key on `blastParams` alone, which left an ortholog
 * launch rendering an empty MSAView for the minutes its alignment takes and, on
 * failure, forever: the error was set and nothing drew it.
 */
const LaunchProgress = observer(function LaunchProgress2({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { blastParams, orthologParams, progress, rid, error } = model
  const { classes } = useStyles()
  const message = blastParams
    ? 'Running EBI BLAST'
    : orthologParams
      ? 'Building ortholog alignment'
      : 'Loading alignment'
  return (
    <div className={classes.margin}>
      {error ? (
        <>
          <Typography variant="h5">{message} failed</Typography>
          {/* the job outlives the browser, so its link is worth keeping next to
              the failure -- EBI's own page says more about a job than we can */}
          {rid ? <JobLink jobId={rid} /> : null}
          <ErrorMessage error={error} />
        </>
      ) : (
        <>
          <LoadingEllipses message={message} variant="h5" />
          {rid ? <JobLink jobId={rid} /> : null}
          <div className={classes.progressRow}>
            <Typography>{progress || 'Initializing'}</Typography>
            {/* stops the polling and returns to the import form; the EBI job
                itself runs on regardless, which is what its JobLink is for */}
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                model.cancelLaunch()
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  )
})

export default LaunchProgress
