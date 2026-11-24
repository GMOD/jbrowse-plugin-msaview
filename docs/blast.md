# BLAST

The BLAST tab searches at **EBI**, not NCBI: NCBI's `Blast.cgi` sends no
`Access-Control-Allow-Origin` header to any origin but its own, so a browser
cannot read a response from it. No plugin version can fix that.

## The searches

- **blastp** finds local alignments against a database. The plugin strips the
  pairwise alignments and aligns the hits together afterwards.
- **phmmer** scores every database sequence against a profile of your query, so
  the hits come back already aligned, and it is more sensitive for remote
  homologs. It returns fewer distinct targets than blastp.
- A **UniRef cluster** is looked up, not searched, so it returns in seconds. It
  reaches sequences within 50% or 90% identity, and nothing beyond.

The default database is `swissprot`, about one curated entry per protein per
species. `uniprotkb` is everything, mostly unreviewed near-duplicates;
`uniprotrefprot` is one proteome per species; phmmer's `rp15` to `rp75` thin the
reference proteomes so no two are more than 15% to 75% similar, which spreads
the hits across the tree of life instead of piling them on mammals.

The cost is EBI's queue, not the search: a blastp against swissprot took 36
seconds, and phmmer jobs 12 to 15 minutes. For a launch that needs no job, use
the Orthologs tab with the in-browser aligner.

## NCBI's `nr`: the manual route

Choose **Manual** on the BLAST tab. It opens NCBI's search page with your
protein filled in. Run BLAST there, click "Multiple Alignment" for COBALT, and
paste the `.aln` (and optionally the `.nh` tree) back into the dialog. The
plugin finds the row holding your protein by its sequence, so nothing needs
typing.

## Contact email

EBI wants a contact address on every job. The plugin ships with the JBrowse
project's, which suits demo volume. A busy site sets its own in the BLAST
settings dialog (gear icon), stored in `localStorage` as `msa-ebiContactEmail`
and used for the alignment jobs too.

The measurements and the reasons behind these choices are in
[agent-docs/blast-design.md](../agent-docs/blast-design.md).
