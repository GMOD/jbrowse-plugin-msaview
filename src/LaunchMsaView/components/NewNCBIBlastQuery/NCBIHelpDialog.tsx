import React from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'
import ExternalLink from '../../../ExternalLink'

export default function NCBIHelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Using NCBI BLAST and COBALT"
      maxWidth="md"
    >
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          Using NCBI BLAST and COBALT
        </Typography>

        <Typography variant="body1" style={{ marginBottom: '16px' }}>
          To perform a multiple sequence alignment using NCBI tools, first run a
          BLAST search. Customize any settings as needed, and choose a database
          of interest such as "nr" for non-redundant protein sequences, or try
          the experimental "nr_clustered" which has reduced redundancy{' '}
          <ExternalLink href="https://ncbiinsights.ncbi.nlm.nih.gov/2022/05/02/clusterednr_1/">
            (more info)
          </ExternalLink>
          . Once you have results, click "Multiple Alignment" at the top of the
          results page to be redirected to COBALT. Once COBALT completes, you
          can download an MSA (.aln file) and optionally a Newick tree (.nh) and
          paste the results into JBrowse
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            onClose()
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
