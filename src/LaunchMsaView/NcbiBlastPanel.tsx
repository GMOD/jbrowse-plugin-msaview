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
import { queryBlast } from './blast'

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
}: {
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [error, setError] = useState<unknown>()
  const [querySequence, setQuerySequence] = useState('')
  const [rid, setRid] = useState<string>()
  const [countdown, setCountdown] = useState<number>()

  return (
    <DialogContent className={classes.dialogContent}>
      {error ? <ErrorMessage error={error} /> : null}
      {rid ? (
        <Typography>
          Waiting for result. RID {rid}. Checking again in {countdown}{' '}
          seconds...
        </Typography>
      ) : null}
      <Typography>Enter sequence:</Typography>
      <TextField
        variant="outlined"
        multiline
        onChange={event => setQuerySequence(event.target.value)}
        minRows={5}
        maxRows={10}
        fullWidth
        value={querySequence}
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
                const database = 'nr'
                const program = 'blastp'
                setError(undefined)
                setRid(undefined)

                const res = await queryBlast({
                  querySequence,
                  database,
                  program,
                  onCountdown: arg => setCountdown(arg),
                  onRid: rid => setRid(rid),
                })
                console.log({ res })
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
