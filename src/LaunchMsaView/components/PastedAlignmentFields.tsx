import React from 'react'

import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import TextField2 from '../../components/TextField2'

const useStyles = makeStyles()({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
  msaInput: {
    marginBottom: 20,
  },
})

const PastedAlignmentFields = observer(function PastedAlignmentFields({
  msaText,
  setMsaText,
  treeText,
  setTreeText,
}: {
  msaText: string
  setMsaText: (text: string) => void
  treeText: string
  setTreeText: (text: string) => void
}) {
  const { classes } = useStyles()
  return (
    <>
      <TextField2
        variant="outlined"
        label="Alignment"
        name="MSA"
        multiline
        minRows={5}
        maxRows={10}
        fullWidth
        className={classes.msaInput}
        slotProps={{ input: { className: classes.textAreaFont } }}
        placeholder="Paste the alignment here (Clustal, aligned FASTA, Stockholm, ...)"
        value={msaText}
        onChange={event => {
          setMsaText(event.target.value)
        }}
      />
      <TextField2
        variant="outlined"
        label="Tree (optional)"
        name="Tree"
        multiline
        minRows={3}
        maxRows={10}
        fullWidth
        slotProps={{ input: { className: classes.textAreaFont } }}
        placeholder="Paste a Newick tree here"
        value={treeText}
        onChange={event => {
          setTreeText(event.target.value)
        }}
      />
    </>
  )
})

export default PastedAlignmentFields
