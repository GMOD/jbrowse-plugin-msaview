import React from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  Divider,
  Typography,
} from '@mui/material'

export default function HelpDialog({
  handleClose,
}: {
  handleClose: () => void
}) {
  return (
    <Dialog open maxWidth="md" onClose={handleClose} title="Launching an MSA">
      <DialogContent>
        <Typography gutterBottom>
          Every tab aligns the same thing: the protein the selected transcript
          translates to. That transcript is the query row, which is what ties
          alignment columns back to codons in the genome view — hovering one
          highlights the other, and clicking navigates.
        </Typography>

        <Typography variant="h6" gutterBottom>
          Orthologs
        </Typography>
        <Typography gutterBottom>
          Precomputed sets, looked up rather than searched for: NCBI and PANTHER
          give one gene per species, and a UniRef cluster gives every UniProtKB
          entry within 50% identity of the query, one per species, from any
          organism. Nothing is queued, so this is the quickest route to
          &quot;this gene across species&quot;.
        </Typography>

        <Typography variant="h6" gutterBottom>
          BLAST query
        </Typography>
        <Typography gutterBottom>
          Searches run at EBI&apos;s Job Dispatcher, which searches UniProtKB.
          Swiss-Prot returns curated sequences that align more cleanly than the
          many near-identical entries a TrEMBL search brings back. blastp finds
          the hits and the chosen aligner then aligns them — &quot;in
          browser&quot; needs no second EBI job. phmmer instead searches with a
          profile HMM built from the query and aligns as it goes, so its output
          is the alignment and nothing is realigned; a hit matching the query in
          more than one place appears once per matched region. The
          Representative Proteomes (15% to 75%) spread the hits across all of
          life.
        </Typography>
        <Typography gutterBottom>
          The EBI queue is the wait, and it runs from seconds to many minutes.
          Searching NCBI&apos;s nr needs the Manual option, which links out to
          NCBI&apos;s own site: NCBI no longer lets a browser read responses
          from Blast.cgi.
        </Typography>

        <Typography variant="h6" gutterBottom>
          Pre-loaded MSA datasets and Manual upload
        </Typography>
        <Typography gutterBottom>
          Both take an alignment that already exists — one a dataset the site
          configured, the other a file or pasted text. In each case the row
          matching the selected transcript is found by comparing residues, not
          by name, because aligners rename the query on the way through.
        </Typography>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
