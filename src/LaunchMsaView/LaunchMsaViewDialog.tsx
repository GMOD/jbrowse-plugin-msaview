import React, { useEffect, useState } from 'react'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
  Typography,
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

function getDisplayName(val?: Feature) {
  return val !== undefined
    ? [val.get('name'), val.get('id')].filter(f => !!f).join(' ')
    : ''
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
  const [geneNameList, setGeneNameList] = useState<string[]>()
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
        const data = result
          .split('\n')
          .map(f => f.trim())
          .filter(f => !!f)
        setGeneNameList(data)
        const set = new Set(data)
        const options = getTranscriptFeatures(feature)
        const ret = options.find(val => set.has(getId(val)))
        if (ret) {
          setUserSelection(getId(ret))
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [feature])
  const set = new Set(geneNameList)
  const options = getTranscriptFeatures(feature)
  const ret = options.find(val => set.has(getId(val)))
  const [userSelection, setUserSelection] = useState(getId(ret ?? options[0]))
  return (
    <Dialog
      maxWidth="xl"
      title="Launch MSA view"
      onClose={() => handleClose()}
      open
    >
      <DialogContent className={classes.dialogContent}>
        <Typography>
          The source data for these multiple sequence alignments is from{' '}
          <a href="https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz100way/alignments/">
            knownCanonical.multiz100way.protAA.fa.gz
          </a>
        </Typography>
        {error ? <ErrorMessage error={error} /> : null}
        {geneNameList && !ret ? (
          <div style={{ color: 'red' }}>No MSA data for this gene found</div>
        ) : null}
        <TextField
          value={userSelection}
          onChange={event => setUserSelection(event.target.value)}
          label="Choose isoform to view MSA for"
          select
        >
          {options
            .filter(val => set.has(getId(val)))
            .map((val, idx) => {
              const d = getDisplayName(val)
              return (
                <MenuItem value={d} key={val.id() + '-' + idx}>
                  {d} (has data)
                </MenuItem>
              )
            })}
          {options
            .filter(val => !set.has(getId(val)))
            .map((val, idx) => {
              const d = getDisplayName(val)
              return (
                <MenuItem value={d} key={val.id() + '-' + idx} disabled>
                  {d}
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
                  treeAreaWidth: 200,
                  treeWidth: 100,
                  drawNodeBubbles: false,
                  labelsAlignRight: true,
                  showBranchLen: false,
                  colWidth: 10,
                  rowHeight: 12,
                  colorSchemeName: 'percent_identity_dynamic',
                  treeFilehandle: {
                    uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz100way/hg38.100way.nh',
                  },
                  data: {
                    msa: d,
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
