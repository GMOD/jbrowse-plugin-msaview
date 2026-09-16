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
 * Every launch that resolves something states its request on the model --
 * `blastParams`, `orthologParams`, `init` -- and one not yet marked
 * `launchCompleted` IS "no alignment yet", as is a completed one whose stored
 * alignment has since expired. The error a failed launch records is only
 * readable here. This used to key on `blastParams` alone, which left an ortholog
 * launch rendering an empty MSAView for the minutes its alignment takes and, on
 * failure, forever: the error was set and nothing drew it.
 */
const LaunchProgress = observer(function LaunchProgress2({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  const { progress, rid, error } = model
  const { classes } = useStyles()
  // the request stays on the model after it succeeds, so an expired
  // alignment's panel is still named after the search that built it
  const pending = !model.launchCompleted
  const { blastParams, orthologParams } = model
  const message = blastParams
    ? `Running EBI ${blastParams.searchProgram === 'phmmer' ? 'phmmer' : 'BLAST'}`
    : orthologParams
      ? orthologParams.source === 'uniref'
        ? 'Building UniRef homolog alignment'
        : 'Building ortholog alignment'
      : 'Loading alignment'
  return (
    <div className={classes.margin}>
      {error ? (
        <>
          <Typography variant="h5">
            {pending ? `${message} failed` : 'Alignment no longer available'}
          </Typography>
          {/* the job outlives the browser, so its link is worth keeping next to
              the failure -- EBI's own page says more about a job than we can */}
          {rid ? <JobLink jobId={rid} /> : null}
          <ErrorMessage error={error} />
          {/* the request stays on the model after a failure, so without these
              the view is a dead end that resubmits the job on every reload */}
          <div className={classes.progressRow}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                model.retryLaunch()
              }}
            >
              Retry
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                model.cancelLaunch()
              }}
            >
              Dismiss
            </Button>
          </div>
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
