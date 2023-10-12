import React, { useEffect, useState } from 'react'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
} from '@mui/material'
import { Feature, getSession } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'
import { ungzip } from 'pako'

// locals

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

export function getTranscriptFeatures(feature: Feature) {
  // check if we are looking at a 'two-level' or 'three-level' feature by
  // finding exon/CDS subfeatures. we want to select from transcript names
  const subfeatures = feature.get('subfeatures') ?? []
  return subfeatures.some(
    f => f.get('type') === 'CDS' || f.get('type') === 'exon',
  )
    ? [feature]
    : subfeatures
}
function getId(val?: Feature) {
  return val !== undefined ? val.get('name') || val.get('id') : ''
}
export default function LaunchProteinViewDialog({
  handleClose,
  feature,
  model,
}: {
  handleClose: () => void
  feature: Feature
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const [error, setError] = useState<unknown>()
  const [data, setData] = useState<string[]>()
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const res = await fetch(
          'https://jbrowse.org/demos/msaview/knownCanonical/list.txt',
        )
        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status} fetching list ${await res.text()}`,
          )
        }
        const result = await res.text()
        setData(
          result
            .split('\n')
            .map(f => f.trim())
            .filter(f => !!f),
        )
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [])
  const set = new Set(data)
  const options = getTranscriptFeatures(feature)

  const [userSelection, setUserSelection] = useState(getId(options[0]))
  return (
    <Dialog
      maxWidth="xl"
      title="Launch MSA view"
      onClose={() => handleClose()}
      open
    >
      <DialogContent className={classes.dialogContent}>
        {error ? <ErrorMessage error={error} /> : null}
        <TextField
          value={userSelection}
          onChange={event => setUserSelection(event.target.value)}
          label="Choose isoform"
          select
        >
          {options.map((val, idx) => {
            const d = getId(val)
            return (
              <MenuItem value={d} key={val.id() + '-' + idx}>
                {d} {set.has(d) ? ' (has data)' : ''}
              </MenuItem>
            )
          })}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            ;(async () => {
              try {
                const res = await fetch(
                  `https://jbrowse.org/demos/msaview/knownCanonical/${userSelection}.mfa.gz`,
                )
                if (!res.ok) {
                  throw new Error(
                    `HTTP ${res.status} fetching ${await res.text()}`,
                  )
                }
                const data = await res.arrayBuffer()
                const d = new TextDecoder().decode(ungzip(data))
                session.addView('MsaView', {
                  type: 'MsaView',
                  data: {
                    msa: d,
                    tree: '',
                  },
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
    </Dialog>
  )
}
