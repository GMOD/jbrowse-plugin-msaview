- Cancellation for the NCBI and PANTHER lookups.
- A length cap on the in-browser aligner.
- Highlighting from every MSA view linked to a genome view, not just the first.
- Guarding transcriptToMsaMap against a malformed transcript.
- The intron-walk speedup, dead-export removal, and a shared EBI job helper.
- A GFF on a view loaded from a file URL is still lost on reload. That needs a
  decision on whether such views should store anything.

Still open: moving both plugins onto core's translateTranscript needs a core
release first.
