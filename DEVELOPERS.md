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
| `columnTracks`        | Per-column tracks supplied as data (bar values or a text row)   |
| `placement`           | Where the view lands: `stack` (default), `splitRight`, `newTab` |

### Building an alignment from a gene: `orthologParams`

This is the launch dialog's **Orthologs (fast)** tab reached declaratively, so a
link can say "NLRP1 across species" and the view builds it. Two of its fields
default so that a spec stays short.

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

Clicking on an MSA column navigates the connected Linear Genome View to the
corresponding genome position. The `handleMsaClick()` action in
`src/MsaViewPanel/model.ts:364-382` handles this.

#### Bidirectional highlighting

- **MSA → Genome**: When hovering over MSA columns, the corresponding genome
  region is highlighted in the Linear Genome View via the
  `LinearGenomeView-TracksContainerComponent` extension point
  (`src/AddHighlightModel/MsaToGenomeHighlight.tsx`)

- **Genome → MSA**: When hovering over the genome view, the corresponding MSA
  column is highlighted (`src/AddHighlightModel/GenomeMouseoverHighlight.tsx`)

### Communication with jbrowse-plugin-protein3d

The MSA view can connect to protein structures displayed in
jbrowse-plugin-protein3d for synchronized highlighting between sequence
alignment and 3D structure.

#### Auto-connection

The plugin automatically discovers and connects to compatible ProteinViews based
on:

1. Matching `connectedViewId` (both views connected to the same genome view)
2. Matching `uniprotId` between MSA row and protein structure

This logic is in `src/MsaViewPanel/model.ts:625-685`.

#### Manual connection

Users can manually connect to protein structures via the menu: **Menu → "Connect
to protein structure..."**

The `ConnectStructureDialog`
(`src/MsaViewPanel/components/ConnectStructureDialog.tsx`) allows selecting:

- Which ProteinView to connect to
- Which structure (if multiple)
- Which MSA row to align with the structure sequence

#### Pairwise alignment

When connecting to a structure, the plugin performs a Needleman-Wunsch pairwise
alignment between the MSA row sequence and the structure's sequence to create
coordinate mappings. This handles cases where sequences may differ slightly.

Key file: `src/MsaViewPanel/pairwiseAlignment.ts`

#### Connection data structure

Each structure connection stores:

```typescript
interface StructureConnection {
  proteinViewId: string
  structureIdx: number
  msaRowName: string
  msaToStructure: Record<number, number> // MSA ungapped → structure position
  structureToMsa: Record<number, number> // structure position → MSA ungapped
}
```

#### Bidirectional highlighting

- **MSA → Structure**: When hovering over MSA columns, the corresponding residue
  is highlighted in the 3D structure via `structure.highlightFromExternal()`

- **Structure → MSA**: When hovering over residues in the 3D structure, the
  corresponding MSA column is highlighted. This works via two mechanisms:
  1. Direct mapping via `structureHoverCol` getter (requires explicit
     connection)
  2. Indirect via genome coordinates: the MSA view observes protein3d's
     `hoverGenomeHighlights` and maps back to MSA columns using `g2p` mapping.
     This works automatically when both views share the same `connectedViewId`.

### Three-way synchronization

When all three views are connected (Linear Genome View, MSA View, and Protein
View), hovering over any one view will highlight the corresponding positions in
the other two views, creating a fully synchronized visualization experience.

```
┌─────────────────────┐
│  Linear Genome View │◄────────────────────────────┐
│    (genome coords)  │                             │
└─────────┬───────────┘                             │
          │                                         │
          │ connectedViewId + connectedFeature      │ hoverGenomeHighlights
          │ (uses p2g/g2p mapping)                  │ (genome coords)
          ▼                                         │
┌─────────────────────┐                   ┌─────────┴───────────┐
│      MSA View       │◄──────────────────│    Protein View     │
│   (aligned seqs)    │  observes genome  │   (3D structure)    │
└─────────┬───────────┘  highlights       └───────────────────────┘
          │                                         ▲
          │ pairwise alignment mapping              │
          │ (msaToStructure/structureToMsa)         │
          └─────────────────────────────────────────┘
```

The MSA view can receive highlights from protein3d via two paths:

1. **Direct**: MSA observes `structure.hoverPosition` (requires explicit
   connection with matching `uniprotId`)
2. **Indirect**: MSA observes `structure.hoverGenomeHighlights` and maps genome
   coords back to MSA columns (works when both share `connectedViewId`)

### Launch mechanisms

The MSA view can be launched from the Linear Genome View via right-click context
menu on gene/mRNA/transcript features. The dialog that opens carries one tab per
data source:

1. **Orthologs (fast)**: look up a precomputed ortholog gene per species (NCBI,
   or PANTHER for the species NCBI's sets leave out, or the query's UniRef
   cluster for everything within 50% identity across UniProtKB) and align what
   comes back. No search job to queue, so this returns in seconds; with the
   in-browser aligner, no job at all
2. **NCBI BLAST query**: submit the protein sequence to NCBI BLAST and align the
   hits. The route for a gene with no resolvable symbol
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
