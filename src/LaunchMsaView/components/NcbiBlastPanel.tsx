import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { ErrorMessage } from '@jbrowse/core/ui'

// locals
import { queryBlast } from '../blast'
import { ncbiBlastLaunchView } from '../ncbiBlastLaunchView'
import {
  AbstractTrackModel,
  Feature,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

const NcbiBlastPanel = observer(function ({
  handleClose,
  feature,
  model,
}: {
  model: AbstractTrackModel
  feature: Feature
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const [error, setError] = useState<unknown>()
  const [query, setQuery] = useState('')
  const [rid, setRid] = useState<string>()
  const [progress, setProgress] = useState('')
  const database = 'nr_cluster_seq'
  const program = 'blastp'

  return (
    <DialogContent className={classes.dialogContent}>
      {error ? <ErrorMessage error={error} /> : null}
      {rid ? (
        <Typography>
          Waiting for result. RID {rid}. {progress}
        </Typography>
      ) : null}

      <Typography>
        Querying {database} with {program}:
      </Typography>
      <Typography>Enter sequence:</Typography>
      <TextField
        variant="outlined"
        multiline
        onChange={event => setQuery(event.target.value)}
        minRows={5}
        maxRows={10}
        fullWidth
        value={query}
        InputProps={{
          classes: {
            input: classes.textAreaFont,
          },
        }}
      />

      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              try {
                setError(undefined)
                setRid(undefined)

                const res = await queryBlast({
                  query,
                  database,
                  program,
                  onProgress: arg => setProgress(arg),
                  onRid: rid => setRid(rid),
                })
                await ncbiBlastLaunchView({
                  session,
                  feature,
                  view,
                  newViewTitle: 'testing',
                  data: res,
                })
                handleClose()
              } catch (e) {
                console.error(e)
                setError(e)
              }
            })()
          }}
        >
          Submit
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
      </DialogActions>
    </DialogContent>
  )
})

export default NcbiBlastPanel
