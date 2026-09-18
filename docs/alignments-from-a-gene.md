# Building an alignment from a gene

Right-click a gene, mRNA or transcript in the genome view and choose to launch
an MSA view. The dialog offers one tab per way of getting an alignment, and each
connects the result to the genome view it came from, so a hover on a column
lights its codon.

1. **Orthologs**: look up a precomputed ortholog gene per species (NCBI, or
   PANTHER for the species NCBI's sets leave out, or the query's UniRef cluster
   for everything within 50% identity across UniProtKB) and align what comes
   back. No search job to queue, so this returns in seconds; with the in-browser
   aligner, no job at all.
2. **BLAST query**: search EBI with blastp or phmmer and align the hits. The
   route for a gene with no resolvable symbol. Its Manual option links out to
   NCBI's own BLAST page for `nr`, which no browser can query directly
   ([BLAST](blast.md) explains why).
3. **Pre-loaded MSA datasets**: alignments the site's config provides
   ([your own alignments](your-own-alignments.md#a-dataset-for-every-gene)).
4. **Manual upload**: an MSA or tree file of your own.

The first two are reachable without the dialog, through the `orthologParams` and
`searchParams` session-spec keys below.
[Launch parameters](launch-parameters.md) has their field tables.

## Orthologs: `orthologParams`

This is the dialog's **Orthologs** tab reached declaratively, so a link can say
"NLRP1 across species" and the view builds it. Two of its fields default so that
a spec stays short.

`proteinSequence` is what the launch dialog always supplies, translated from the
transcript the user picked, because that is the row `connectedFeature` maps
genome coordinates through. A spec naming a gene has no transcript to translate
and should not have to carry ~1.5 kB of residues in a url, so it gets NCBI's
representative protein instead, which is also the choice every other row makes.
A query row taken from the representative additionally passes the byte-identity
test that attaches its `Accession`, so the CDD domain overlay is there by
construction.

### Which source

`source` picks which precomputed ortholog set answers. NCBI Datasets computes
orthologs for vertebrates and insects only, so a yeast gene gets three yeast
rows there and a fly gene only insects. PANTHER's sets span its 144 reference
proteomes, human to yeast to Arabidopsis: `source: "panther"` for yeast CDC28
returns 94 rows with human among them, for fly Antp 26 rows from human to worm
(measured 2026-08-25). A PANTHER launch names the gene by symbol, resolves it
with one `matchortho` call, prefers each genome's LDO (PANTHER's one-to-one
pick) and takes the sequences from UniProt, so every row's `Accession` is a
UniProt accession rather than a RefSeq one. The CDD overlay reads those through
the same `efetch` GenPept path: it serves Swiss-Prot accessions, with CDD Region
features, exactly as it serves RefSeq ones (P00546 carries three), and it
answers a TrEMBL accession with HTTP 400. A batch mixing the two returns the
Swiss-Prot records and drops the rest, so the overlay lands on the reviewed rows
(the model organisms) and not on the unreviewed ones. A launch whose rows are
all TrEMBL would 400 the whole batch and log "auto-load failed"; the alignment
itself is unaffected. `source` omitted, or an old link without the key, runs the
NCBI path unchanged.

`source: "uniref"` asks a different question: not "this gene's ortholog in each
species" but "everything in UniProtKB within 50% identity of this protein",
which UniProt has already clustered. The launch resolves the gene (or a UniProt
accession given as a candidate, `geneCandidates: ["P04637"]`) to its entry,
finds the entry's UniRef50 cluster, and lists the cluster's members, one per
species, reviewed entries first. Three requests to rest.uniprot.org, which sends
`Access-Control-Allow-Origin: *`, and no job anywhere. `identity: 90` takes the
tighter UniRef90 cluster instead; `referenceProteomesOnly: false` admits every
strain and isolate rather than the reference proteome's one entry per taxon.
Human TP53 measured 2026-09-05: 191 UniProtKB members at 50%, 129 of them from
reference proteomes, in about two seconds. A cluster stops at its identity
threshold, so it reaches p53's mammals and not its fish; the remote homologs are
what `searchParams` is for.

### Aligning in the browser

Pair it with `msaAlgorithm: "browser"` and the whole launch never touches EBI:
the page aligns the rows to the query (`utils/browserAlign.ts`, one column per
query residue plus the insert columns each row needs) and builds the tree with
react-msaview's own neighbour joining over the result. That aligner is also the
one to name for any other source when a launch has to be quick or must not
depend on EBI's queue, which has been measured at anything from ten seconds to
fifteen minutes for the same job on different days.

```
session=spec-{"views":[{
  "type": "MsaView",
  "orthologParams": {"taxId":9606,"geneCandidates":["P04637","TP53"],"source":"uniref","msaAlgorithm":"browser"},
  "allowedGappyness": 50
}]}
```

### Where new sources belong

Live ortholog services are the sources that cost per-source code: an interactive
lookup against NCBI, PANTHER or UniProt each needed its own client.
`msaIndexedLocation` — a hosted bgzip alignment random-read by gene name — costs
none, and new species coverage belongs there. A build script derives the
alignment offline (react-msaview's `scripts/gene-explorer/build-data.mjs` does
it for UCSC multiz) and the session names a URL, so the plugin renders it
without knowing where the rows came from.
[Your own alignments](your-own-alignments.md#one-file-read-by-transcript-msaindexedlocation)
has the file layout.

## Searching: `searchParams`

The dialog's BLAST tab reached declaratively: a similarity search of UniProtKB
at EBI, then an alignment of what it found.

phmmer's `rp15` database is the widest net the search offers: UniProt's
reference proteomes thinned to representatives no more than 15% similar, so
every hit is a different corner of the tree of life. phmmer aligns as it
searches, so its result is the alignment and no aligner runs after it; blastp's
hits are pairwise and go to `msaAlgorithm`.

```
session=spec-{"views":[{
  "type": "MsaView",
  "searchParams": {"searchProgram":"phmmer","blastDatabase":"rp15","accession":"P04637","maxHits":50}
}]}
```

Search programs sit behind one interface, `SearchBackend` in
`utils/homologSearch.ts`: a request in, hits out, aligned or not. A self-hosted
DIAMOND or MMseqs2 endpoint would be a third entry in `searchBackends` returning
bare hits, and nothing downstream of it would change. [BLAST](blast.md) covers
why the searches run at EBI and what they cost.
