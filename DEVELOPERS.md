### Storage details

- Database name: `jbrowse-msaview-data`
- Stored data includes: MSA alignment, tree, and tree metadata
- Each entry is timestamped for cleanup purposes

This mechanism is transparent to users and requires no configuration.

## LaunchView-MsaView extension point

This plugin registers a `LaunchView-MsaView` extension point that allows
programmatic launching of an MsaView. This can be used via the JBrowse 2 session
spec URL parameters (see https://jbrowse.org/jb2/docs/urlparams/#session-spec).

### Parameters

Exactly one of the five **sources** is required. The first three name an
alignment that already exists; `orthologParams` and `searchParams` name no
alignment at all and build one at launch (see below).

| Source               | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `data`               | `{ msa: string, tree?: string }`                              |
| `msaFileLocation`    | `{ uri: string }` for MSA file                                |
| `msaIndexedLocation` | `{ uri: string }` for a name-indexed bgzip block              |
| `orthologParams`     | build the alignment from a precomputed ortholog or UniRef set |
| `searchParams`       | build the alignment from a similarity search                  |

Everything else is optional.

| Parameter             | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `treeFileLocation`    | `{ uri: string }` for tree file                                 |
| `connectedViewId`     | ID of connected LinearGenomeView                                |
| `connectedFeature`    | Feature for cross-linking                                       |
| `connectedTranscript` | Transcript id to look up in the connected view instead, below   |
| `displayName`         | Custom view display name                                        |
| `colorSchemeName`     | Color scheme (e.g., 'percent_identity_dynamic')                 |
| `colWidth`            | Column width in pixels                                          |
| `rowHeight`           | Row height in pixels                                            |
| `allowedGappyness`    | Hide any column gappier than this percent, 100 to keep          |
| `treeAreaWidth`       | Tree area width                                                 |
| `treeWidth`           | Tree width                                                      |
| `drawNodeBubbles`     | Show node bubbles on tree                                       |
| `labelsAlignRight`    | Align labels to the right                                       |
| `showBranchLen`       | Show branch lengths                                             |
| `querySeqName`        | Name for query sequence                                         |
| `highlightColumns`    | Visible column indices to highlight on open                     |
| `highlights`          | Labeled residue, column, or row highlights, see below           |
| `region`              | Residues or columns to open zoomed onto, see below              |
| `columnTracks`        | Per-column tracks supplied as data (bar values or a text row)   |
| `placement`           | Where the view lands: `stack` (default), `splitRight`, `newTab` |

### Building an alignment from a gene: `orthologParams`

This is the launch dialog's **Orthologs** tab reached declaratively, so a link
can say "NLRP1 across species" and the view builds it. Two of its fields default
so that a spec stays short.

| Field                    | Required | Description                                                      |
| ------------------------ | -------- | ---------------------------------------------------------------- |
| `taxId`                  | Yes      | NCBI taxon id of the assembly the query gene came from           |
| `geneCandidates`         | Yes      | Gene identifiers, tried in order until one resolves              |
| `msaAlgorithm`           | Yes      | `clustalo`, `muscle`, `kalign`, `mafft` or `browser`, see below  |
| `taxa`                   | No       | Taxon ids to include. Omitted means every species the source has |
| `maxSpecies`             | No       | Rows to align, 100 when omitted                                  |
| `proteinSequence`        | No       | The QUERY row. Omitted means the source's representative protein |
| `selectedTranscript`     | No       | The transcript the query row was translated from                 |
| `source`                 | No       | `ncbi` (the default), `panther` or `uniref`, see below           |
| `identity`               | No       | UniRef only: `50` (the default) or `90`                          |
| `referenceProteomesOnly` | No       | UniRef only: keep reference-proteome members, `true` by default  |

`proteinSequence` is what the launch dialog always supplies, translated from the
transcript the user picked, because that is the row `connectedFeature` maps
genome coordinates through. A spec naming a gene has no transcript to translate
and should not have to carry ~1.5 kB of residues in a url, so it gets NCBI's
representative protein instead, which is also the choice every other row makes.
A query row taken from the representative additionally passes the byte-identity
test that attaches its `Accession`, so the CDD domain overlay is there by
construction.

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

Pair it with `msaAlgorithm: "browser"` and the whole launch never touches EBI:
the rows are aligned to the query in the page (utils/browserAlign.ts, one column
per query residue plus the insert columns each row needs) and the tree is
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

Live ortholog services are the sources that cost per-source code: an interactive
lookup against NCBI, PANTHER or UniProt each needed its own client.
`msaIndexedLocation` — a hosted bgzip alignment random-read by gene name — costs
none, and new species coverage belongs there. A build script derives the
alignment offline (react-msaview's `scripts/gene-explorer/build-data.mjs` does
it for UCSC multiz) and the session names a URL, so the plugin renders it
without knowing where the rows came from.

### Searching for the alignment: `searchParams`

The dialog's BLAST tab reached declaratively: a similarity search of UniProtKB
at EBI, then an alignment of what it found. The query comes from
`proteinSequence`, else is fetched for a UniProt `accession`, else is translated
from the view's `connectedTranscript`.

| Field           | Required | Description                                                          |
| --------------- | -------- | -------------------------------------------------------------------- |
| `searchProgram` | No       | `phmmer` or `blastp` (the default)                                   |
| `blastDatabase` | Yes      | a database of that program's, see `consts.ts`                        |
| `accession`     | No       | UniProt accession to fetch the query from                            |
| `maxHits`       | No       | hits to keep, 100 when omitted                                       |
| `msaAlgorithm`  | blastp   | the aligner for blastp's hits, `browser` included; phmmer needs none |

phmmer's `rp15` database is the widest net the search offers: UniProt's
reference proteomes thinned to representatives no more than 15% similar, so
every hit is a different corner of the tree of life. phmmer aligns as it
searches, so its result is the alignment and no aligner runs after it; blastp's
hits are pairwise and go to `msaAlgorithm`. The name `searchParams` is the
spec's; the model stores it as `blastParams`, the name the dialog has always
used.

```
session=spec-{"views":[{
  "type": "MsaView",
  "searchParams": {"searchProgram":"phmmer","blastDatabase":"rp15","accession":"P04637","maxHits":50}
}]}
```

Search programs sit behind one interface, `SearchBackend` in
`utils/homologSearch.ts`: a request in, hits out, aligned or not. A self-hosted
DIAMOND or MMseqs2 endpoint would be a third entry in `searchBackends` returning
bare hits, and nothing downstream of it would change.

### Naming the transcript: `connectedTranscript`

`connectedFeature` is the transcript's exon model, ~1.5 kB of coordinates a
person cannot type. `connectedTranscript` is its short form: a transcript id
(`NM_000546.6`, version optional) that the view looks up in the connected genome
view's open tracks once that view has loaded, and translates to become the query
row of a `searchParams` or `orthologParams` launch that names no
`proteinSequence`. The genome view has to be on the gene's locus with a gene
track open, which is what a spec pinning its `id` already does.

```
session=spec-{"views":[
  {"type":"LinearGenomeView","id":"lgv1","assembly":"hg38","loc":"chr17:7,668,000-7,688,000","tracks":["hg38-ncbiRefSeqCurated"]},
  {"type":"MsaView","connectedViewId":"lgv1","connectedTranscript":"NM_000546.6","placement":"splitRight",
   "orthologParams":{"taxId":9606,"geneCandidates":["TP53"],"source":"uniref","msaAlgorithm":"browser"}}
]}
```

`allowedGappyness` is worth setting alongside it. Proteins that differ in length
put one row's private N-terminal extension at column 0 with every other row gap
underneath, so a launch that does not say otherwise can open on columns the link
was not about.

```
session=spec-{"views":[{
  "type": "MsaView",
  "orthologParams": {"taxId":9606,"geneCandidates":["NLRP1"],"msaAlgorithm":"clustalo"},
  "allowedGappyness": 80
}]}
```

### Pointing at a residue: `highlights`

A link that is about one residue should say so in that residue's own numbering.
`highlights` takes 1-based inclusive ranges: `{row, start, end}` for residues of
the named row, `{start, end}` for alignment columns, `{rows: [...]}` for whole
rows, each with an optional `label` and `color`. The viewer projects a residue
range through the alignment's gaps, so it lands on the same residues whatever
`allowedGappyness` hides, where `highlightColumns` names visible column indices
that shift with it.

```
session=spec-{"views":[{
  "type": "MsaView",
  "msaFileLocation": {"uri": "https://.../tp53-p53-orthologs.fa"},
  "querySeqName": "human",
  "highlights": [{"row": "human", "start": 339, "end": 350, "label": "NES"}]
}]}
```

A connected protein3d view still lights the alignment through the volatile
highlighted-columns channel, so its hover and click draw on top of these and
never replace them. `columnTracks` follows the same contract for per-column
numbers or a text row; both fields are documented in react-msaview's
`docs/layers.md`.

### Opening on a residue: `region`

`region` takes the same 1-based inclusive coordinates as `highlights`:
`{row, start, end}` for residues of that row, `{start, end}` for alignment
columns. The view zooms onto it once the alignment and any tree file have
loaded, then drops the key, so a reloaded session opens wherever the reader left
it. A plugin release older than the one that shipped `region` ignores the key
and opens at column 0.

```
session=spec-{"views":[{
  "type": "MsaView",
  "msaFileLocation": {"uri": "https://.../tp53-p53-orthologs.fa"},
  "querySeqName": "human",
  "highlights": [{"row": "human", "start": 248, "end": 248, "label": "R248"}],
  "region": {"row": "human", "start": 230, "end": 290}
}]}
```

### Where the view lands: `placement`

A launch states its arrangement instead of leaving the reader to drag the view
into place. `placement` takes one of three values:

| Value        | Effect                                                              |
| ------------ | ------------------------------------------------------------------- |
| `stack`      | append below whatever is on screen. The default                     |
| `splitRight` | its own cell to the right, so a connected genome view stays visible |
| `newTab`     | its own tab in the current cell, a click away from the rest         |

Anything other than `stack` needs a host with tiled workspaces (jbrowse-web or
desktop, v5 and later), and turns workspaces on for that session while leaving
the visitor's own default untouched. An embedded session, or a release that
places views its own way, stacks and says so in the console.

The default is `stack` and stays `stack`: it is what every link written before
this key existed already does. The launch **dialog** defaults to `splitRight`
instead, remembered per browser, because a launch from a gene feature carries
`connectedViewId` and the pair reads as a left/right split.

```
session=spec-{"views":[
  {"type":"LinearGenomeView","id":"lgv1","assembly":"hg38","loc":"chr1:100-200"},
  {"type":"MsaView","connectedViewId":"lgv1","placement":"splitRight",
   "msaFileLocation":{"uri":"https://example.com/alignment.fa"}}
]}
```

`id` on the genome view is what lets the MSA view name it — the two are then
connected, so a hover in one highlights the other, and `splitRight` puts them
where both are visible.

For anything richer than "this view, over there", state the whole arrangement
with the host's own
[`layout`](https://jbrowse.org/jb2/docs/urlparams/#tiled-views--workspaces) key,
which is a tree of panels and sizes applied once every view in the spec has
launched:

```
session=spec-{
  "views":[
    {"type":"LinearGenomeView","id":"lgv1","assembly":"hg38","loc":"chr1:100-200"},
    {"type":"MsaView","connectedViewId":"lgv1",
     "msaFileLocation":{"uri":"https://example.com/alignment.fa"}}
  ],
  "layout":{"direction":"horizontal","children":[{"views":[0],"size":40},{"views":[1],"size":60}]}
}
```

`layout` wins over `placement`, being the later and more specific statement, so
a spec carrying both gets the tree it drew.

### Demo: p53 variant evidence

[This link](https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/ucsc/hg38/config.json&session=spec-{%22views%22:[{%22type%22:%22LinearGenomeView%22,%22id%22:%22lgv1%22,%22assembly%22:%22hg38%22,%22loc%22:%22chr17:7,661,779-7,687,538%22,%22tracks%22:[%22hg38-ncbiRefSeqSelect%22,%22hg38-clinvarMain%22]},{%22type%22:%22MsaView%22,%22displayName%22:%22p53%20across%20vertebrates%22,%22msaFileLocation%22:{%22uri%22:%22https://gmod.org/JBrowseMSA/demo/data/p53/p53-vertebrates.afa%22},%22treeFileLocation%22:{%22uri%22:%22https://gmod.org/JBrowseMSA/demo/data/p53/p53-vertebrates.nh%22},%22querySeqName%22:%22Human%22,%22relativeTo%22:%22Human%22,%22connectedViewId%22:%22lgv1%22,%22connectedTranscript%22:%22NM_000546.6%22,%22placement%22:%22splitRight%22,%22colorSchemeName%22:%22clustalx_protein_dynamic%22,%22highlights%22:[{%22row%22:%22Human%22,%22start%22:102,%22end%22:292,%22label%22:%22DNA-binding%22,%22color%22:%22rgba%28255,140,0,0.15%29%22},{%22row%22:%22Human%22,%22start%22:175,%22end%22:175,%22label%22:%22R175%22},{%22row%22:%22Human%22,%22start%22:245,%22end%22:245,%22label%22:%22G245%22},{%22row%22:%22Human%22,%22start%22:248,%22end%22:248,%22label%22:%22R248%22},{%22row%22:%22Human%22,%22start%22:249,%22end%22:249,%22label%22:%22R249%22},{%22row%22:%22Human%22,%22start%22:273,%22end%22:273,%22label%22:%22R273%22},{%22row%22:%22Human%22,%22start%22:282,%22end%22:282,%22label%22:%22R282%22}],%22columnTracks%22:[{%22id%22:%22clinvar%22,%22name%22:%22ClinVar%20pathogenic%20missense%22,%22kind%22:%22bar%22,%22row%22:%22Human%22,%22color%22:%22%23c0392b%22,%22height%22:60,%22max%22:8,%22values%22:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1,0,0,2,4,3,0,6,0,0,0,0,0,0,0,0,0,0,1,2,1,5,0,0,2,2,3,1,1,4,0,0,2,0,0,2,0,3,0,0,0,1,0,0,0,6,2,0,0,1,1,3,6,2,0,1,0,2,1,1,0,0,2,0,0,2,1,3,0,3,3,1,3,5,1,3,0,0,0,0,0,0,0,0,1,0,0,4,3,1,1,1,0,1,0,0,0,0,0,3,0,0,0,0,0,0,0,3,2,1,1,0,1,0,3,0,0,0,0,0,0,0,0,0,0,0,3,0,4,0,2,4,6,2,3,5,2,0,4,5,4,1,6,2,1,2,0,1,3,0,0,0,2,1,0,0,0,0,0,2,3,3,0,1,4,1,3,6,0,2,1,1,3,0,3,8,3,1,0,2,2,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,0,0,5,0,0,0,1,1,0,2,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},{%22id%22:%22alphamissense%22,%22name%22:%22AlphaMissense%20mean%20%28x100%29%22,%22kind%22:%22bar%22,%22row%22:%22Human%22,%22color%22:%22%231565c0%22,%22height%22:60,%22max%22:100,%22values%22:[49,27,19,11,12,14,18,10,12,14,28,17,40,57,73,65,65,68,95,29,30,72,95,21,24,60,39,21,18,17,18,16,17,12,11,13,14,13,14,21,22,20,17,20,16,16,15,14,17,17,15,13,37,29,11,19,16,11,11,12,14,20,14,12,11,20,13,19,15,14,12,13,15,17,14,17,15,19,20,17,15,15,22,22,19,22,20,24,17,23,67,41,46,66,63,37,90,98,63,35,36,20,76,15,99,13,58,48,98,26,81,57,97,43,17,64,87,68,90,98,96,92,73,81,98,91,95,23,13,81,56,97,84,97,98,87,86,81,91,84,94,93,89,66,81,57,77,26,20,13,90,69,17,52,70,49,91,98,87,88,94,87,95,89,48,54,52,76,76,68,92,87,98,78,99,100,98,97,100,96,85,50,38,52,32,74,52,32,83,87,71,47,99,95,89,95,91,96,95,81,20,25,69,48,98,24,64,93,17,23,84,56,99,92,91,93,70,89,76,91,77,27,92,87,57,92,58,35,54,68,75,87,85,87,74,93,96,100,95,98,99,100,94,100,100,98,97,100,99,93,93,59,91,91,87,92,93,99,87,22,21,94,24,76,83,99,98,36,61,97,93,93,99,95,100,97,100,100,99,100,100,97,84,60,98,96,47,62,13,18,56,34,17,17,11,9,9,16,11,15,13,18,20,17,81,75,26,26,23,13,12,14,16,18,18,14,15,15,47,54,46,19,13,34,24,50,56,88,36,87,48,93,63,98,73,40,89,90,45,60,88,51,36,81,77,55,79,75,87,31,54,67,23,18,17,16,25,22,13,15,15,16,20,18,15,20,25,13,15,56,21,47,45,21,16,16,15,21,16,20,66,47,13,26,19,66,13,28,18,16,47,54,66]},{%22id%22:%22mavedb%22,%22name%22:%22MaveDB%20nutlin-3,%20p53WT%22,%22kind%22:%22bar%22,%22row%22:%22Human%22,%22color%22:%22%232e7d32%22,%22height%22:60,%22max%22:2,%22values%22:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.6,0,0.1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.1,0,0,0.2,0.4,0,0,0,0,0.1,0,0.8,0,0.7,0.3,1.6,0.1,1.4,0.1,1.3,0,0,0,0.1,0,0.1,0.5,0.2,0.4,0.4,0.8,0.8,1.4,1.5,0.1,0.1,1.2,1,1.7,1.1,1.4,1.3,0.8,0.5,0.5,0.8,0.4,1.2,0.4,1.4,0.7,1.2,0.6,1.1,0.5,0.4,0.6,1.5,1.3,0,0.7,1.3,0.3,1.4,1,1.4,0.8,1.4,0.8,1.8,0.8,0.3,0,0.2,0.8,0.4,0,0.6,0.7,1.7,1,1.2,2,1.1,0.6,2,0.8,0.7,0.3,0.1,0.4,0.2,0.3,0.1,0.1,0.5,0.8,0.1,0.1,1.4,1.6,1.4,0.7,1.3,0.1,0.1,0,0,0,0.9,0.3,1.8,0,0,1,0,0.1,0.9,0.7,1.2,1.1,1.5,1.4,0.6,1.3,0.5,1.5,0.4,0.3,0.6,0.3,0.1,0.4,0.3,0.2,0.7,0.5,0.6,1.4,0.5,1.4,0.6,1.7,1.1,1.9,0.8,1.3,1.3,1.7,0.9,1.7,2.2,2,0.9,1.5,2.1,1,1.4,0.3,1.3,1.2,1.4,0.8,1.4,1.4,0.9,0.5,0.5,0.7,0.5,0.5,0.8,1.6,1,0.9,0.8,1.5,1.3,1.5,1.5,1.7,1.8,0.5,0.4,2,0,0.9,0.6,1,0,0,1,1.8,0,0.1,0.2,0.1,0.2,0,0.1,0.4,0.4,0.3,0.4,0.6,0.4,0.6,0.5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}],%22region%22:{%22row%22:%22Human%22,%22start%22:170,%22end%22:290}},{%22type%22:%22ProteinView%22,%22uniprotId%22:%22P04637%22,%22transcriptId%22:%22NM_000546.6%22,%22connectedViewId%22:%22lgv1%22,%22connectedView%22:{%22assembly%22:%22hg38%22,%22loc%22:%22chr17:7,661,779-7,687,538%22,%22tracks%22:[%22hg38-ncbiRefSeqSelect%22]}}]})
opens three views on jbrowse.org's hg38 hub config, which already loads this
plugin and jbrowse-plugin-protein3d:

- a genome view pinned as `lgv1` on TP53, with RefSeq Select listed before
  ClinVar so the transcript lookup finds `NM_000546.6` in the first track it
  reads
- an MSA view of the vertebrate p53 alignment hosted at
  `gmod.org/JBrowseMSA/demo/data/p53/`, connected to `lgv1` through
  `connectedTranscript`, with the ClinVar, AlphaMissense and MaveDB tracks from
  that folder's `p53-layers.json` inlined as `columnTracks`, the DNA-binding
  domain and six hotspots as `highlights`, and a `region` on the hotspots
- a ProteinView of AlphaFold's P04637 model, connected to the same genome view
  by `transcriptId`

The alignment's Human row is P04637's canonical sequence, which is what
NM_000546.6 translates to, so the three views share one coordinate map. The spec
escapes `#`, `&`, `%` and `+` and nothing else: a track color's `#` would
otherwise end the query string, and escaping everything takes the URL past the 8
kB request line the host accepts.

### URL example

```
https://jbrowse.org/code/jb2/main/?config=config.json&session=spec-{"views":[{"type":"MsaView","msaFileLocation":{"uri":"https://example.com/alignment.fa"}}]}
```

### Programmatic usage

```typescript
pluginManager.evaluateExtensionPoint('LaunchView-MsaView', {
  session,
  data: { msa: clustalOutput, tree: newickTree },
  displayName: 'My MSA',
  colorSchemeName: 'percent_identity_dynamic',
})
```

## Inter-plugin communication

This plugin supports bidirectional communication with both the Linear Genome
View and jbrowse-plugin-protein3d for synchronized highlighting and navigation.

### Communication with Linear Genome View

The MSA view can be connected to a Linear Genome View to enable cross-linking
between MSA columns and genome coordinates.

#### Connection mechanism

When launching an MSA view from a gene feature (via right-click context menu),
the plugin stores:

- `connectedViewId`: The ID of the Linear Genome View
- `connectedFeature`: The gene/transcript feature for coordinate mapping

#### Coordinate mapping

The plugin uses the `transcriptToMsaMap` (generated by g2p_mapper) to convert
between MSA positions and genome coordinates:

1. MSA column (gapped) → ungapped position
2. Ungapped position → protein position
3. Protein position → genome coordinates (via `p2gCodon`, the full set of
   genomic bases in the codon, so the region is exact on either strand and a
   codon split across an exon boundary yields one region per piece)

Both directions have a coordinate-base conversion to get right:
`session.hovered.hoverPosition.coord` is a **1-based** display coordinate
(core's `pxToBp` adds the +1), while `g2p`/`p2gCodon` and the regions handed to
`bpToPx` are **0-based**.

Key files:

- `src/MsaViewPanel/msaCoordToGenomeCoord.ts` - MSA to genome conversion
- `src/MsaViewPanel/genomeToMSA.ts` - Genome to MSA conversion

#### Click navigation

Clicking an MSA column navigates the connected genome view to the codon under
it, or zooms to it when the view menu's "Zoom to base level on click?" is on
(`handleMsaClick` in `src/MsaViewPanel/model.ts`).

#### Bidirectional highlighting

- **MSA to genome**: the codon under the hovered or clicked column is drawn over
  the genome view through the `LinearGenomeView-TracksContainerComponent`
  extension point (`src/AddHighlightModel/MsaToGenomeHighlight.tsx`)
- **Genome to MSA**: the genome view's hover position lights the matching column
  (`syncGenomeHoverToMsaColumn` in `src/MsaViewPanel/afterCreateAutoruns.ts`),
  and `GenomeMouseoverHighlight.tsx` marks the hovered base itself

### Communication with jbrowse-plugin-protein3d

The two plugins share no coordinate space except the genome, so they talk
through the genome view both are connected to, matched by `connectedViewId`.
Neither maps a structure to an alignment row directly.

- **Structure to MSA**: `observeProteinHighlights`
  (`src/MsaViewPanel/afterCreateAutoruns.ts`) reads each connected structure's
  `hoverGenomeHighlights` (the residue under the pointer) and
  `clickGenomeHighlights` (the selected domain, also what protein3d's
  `initialSelection` lights), maps them through the transcript to the query row,
  and lights those columns. A hover outranks a click selection, which outranks
  the view's own `highlightColumns`.
- **MSA to structure**: protein3d reads this view's `connectedHoverHighlights`,
  the genome regions of the hovered column's codon, and lights the residue they
  translate to. That getter is a cross-plugin contract, as is
  `connectedHighlights`, which jbrowse-plugin-mafviewer reads.

Connecting all three views to one genome view gives three-way hover sync:

```
      Linear Genome View
       ▲              ▲
       │ codon        │ hover/click genome highlights
       ▼              ▼
    MSA View ◄──────► Protein View
         (through the genome view)
```

### Launch mechanisms

The MSA view can be launched from the Linear Genome View via right-click context
menu on gene/mRNA/transcript features. The dialog that opens carries one tab per
data source:

1. **Orthologs**: look up a precomputed ortholog gene per species (NCBI, or
   PANTHER for the species NCBI's sets leave out, or the query's UniRef cluster
   for everything within 50% identity across UniProtKB) and align what comes
   back. No search job to queue, so this returns in seconds; with the in-browser
   aligner, no job at all
2. **BLAST query**: search EBI with blastp or phmmer and align the hits. The
   route for a gene with no resolvable symbol. Its Manual option links out to
   NCBI's own BLAST page for `nr`, which no browser can query directly (see
   docs/blast.md)
3. **Pre-loaded MSA datasets**: use pre-calculated alignments from configuration
4. **Manual upload**: load MSA/tree files directly

Each launch method automatically sets up the genome view connection for
coordinate mapping and highlighting.

The first two are reachable without the dialog, via `orthologParams` and
`searchParams` above.

## Data persistence

MSA datasets loaded from inline data (pasted text, local file uploads) are
automatically stored in the browser's IndexedDB to enable persistence across
page refreshes. This works around a limitation in react-msaview that strips
large data from session snapshots.

### How it works

1. When MSA data is loaded from inline sources (not URL-based files), it is
   automatically stored in IndexedDB
2. A reference ID (`dataStoreId`) is saved in the session snapshot instead of
   the raw data
3. On page reload, the plugin detects the `dataStoreId` and retrieves the data
   from IndexedDB
4. Old IndexedDB entries are automatically cleaned up after 7 days

Note: URL-based files (loaded via file selector with a URL) don't need IndexedDB
storage as they can be reloaded directly from the URL.

## Screenshots

The E2E suites write reference PNGs under `test-screenshots/`. puppeteer
captures aren't pixel-deterministic (antialiasing, WebGL/canvas, font hinting),
so `scripts/pngSnapshot.mjs` normalizes each capture through `pngquant --nofs`
and only overwrites a committed PNG when it differs by more than ~1% of pixels —
otherwise the existing file is left byte-for-byte intact, so unrelated runs
don't churn git. Tune the threshold with `SCREENSHOT_DIFF_RATIO` (e.g. `0` to
always rewrite, `0.05` to tolerate larger wobble). `pngquant` is optional: where
it's absent the raw PNG is used as a fallback.

### The README figure

`img/1.png` is a capture of the README's demo link, not a hand-made screenshot.
`pnpm readme-figure` loads that link on the hosted `main` build with the local
`dist/` answering for this plugin, drops the ProteinView (protein3d's, and
molstar gets no WebGL in headless Chrome), and writes the figure through the
same tolerance as the test references. The `version` lifecycle runs it, so each
release commits a figure of its own UI. When the capture fails there, the script
prints a warning and keeps the old figure, so a slow gmod.org or UCSC cannot
hold up a release.

Change the demo link and the figure follows at the next release. Run
`pnpm build && pnpm readme-figure` to see it sooner.
