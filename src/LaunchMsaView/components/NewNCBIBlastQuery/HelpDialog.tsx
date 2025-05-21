import React from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'

export default function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Using NCBI BLAST and COBALT"
      maxWidth="md"
    >
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          Using NCBI BLAST and COBALT for Multiple Sequence Alignment
        </Typography>

        <Typography variant="subtitle1" gutterBottom>
          Step 1: Run BLAST Search
        </Typography>
        <Typography variant="body1" style={{ marginBottom: '16px' }}>
          1. Click the link provided or copy the protein sequence.
          <br />
          2. On the NCBI BLAST page, verify your sequence is in the query box.
          <br />
          3. Select appropriate database (e.g., "nr" for non-redundant protein
          sequences).
          <br />
          4. Click the "BLAST" button and wait for results.
        </Typography>

        <Typography variant="subtitle1" gutterBottom>
          Step 2: Select Sequences for Alignment
        </Typography>
        <Typography variant="body1" style={{ marginBottom: '16px' }}>
          1. From your BLAST results, select sequences of interest by checking
          the boxes next to them.
          <br />
          2. Click "Multiple Alignment" at the top of the results page.
          <br />
          3. This will redirect you to COBALT (Constraint-based Multiple
          Alignment Tool).
        </Typography>

        <Typography variant="subtitle1" gutterBottom>
          Step 3: Generate Multiple Sequence Alignment
        </Typography>
        <Typography variant="body1" style={{ marginBottom: '16px' }}>
          1. On the COBALT page, review your selected sequences.
          <br />
          2. Click "Align" to generate the multiple sequence alignment.
          <br />
          3. Once alignment is complete, you can view it in various formats.
        </Typography>

        <Typography variant="subtitle1" gutterBottom>
          Step 4: Export Results
        </Typography>
        <Typography variant="body1" style={{ marginBottom: '16px' }}>
          1. For the MSA: Click "Download" and select "FASTA" or "Clustal"
          format.
          <br />
          2. For the tree: Click "Tree" view, then "Newick" to get the tree in
          Newick format.
          <br />
          3. Copy the MSA and tree data and paste them into the respective
          fields in this dialog.
        </Typography>

        <Typography variant="subtitle1" gutterBottom>
          Step 5: Submit to JBrowse
        </Typography>
        <Typography variant="body1" style={{ marginBottom: '16px' }}>
          1. Paste the MSA data into the "Paste resulting MSA here" field.
          <br />
          2. (Optional) Paste the Newick tree into the "Paste a newick tree
          here" field.
          <br />
          3. Click "Submit" to visualize your alignment in JBrowse.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { onClose() }} color="primary" variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
