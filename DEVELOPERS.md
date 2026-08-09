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

Exactly one of the four **sources** is required. The first three name an
alignment that already exists; `orthologParams` names no alignment at all and
builds one at launch (see below).

| Source               | Description                                       |
| -------------------- | ------------------------------------------------- |
| `data`               | `{ msa: string, tree?: string }`                  |
| `msaFileLocation`    | `{ uri: string }` for MSA file                    |
| `msaIndexedLocation` | `{ uri: string }` for a name-indexed bgzip block  |
| `orthologParams`     | build the alignment from NCBI orthologs at launch |

Everything else is optional.

| Parameter          | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `treeFileLocation` | `{ uri: string }` for tree file                        |
| `connectedViewId`  | ID of connected LinearGenomeView                       |
| `connectedFeature` | Feature for cross-linking                              |
| `displayName`      | Custom view display name                               |
| `colorSchemeName`  | Color scheme (e.g., 'percent_identity_dynamic')        |
| `colWidth`         | Column width in pixels                                 |
| `rowHeight`        | Row height in pixels                                   |
| `allowedGappyness` | Hide any column gappier than this percent, 100 to keep |
| `treeAreaWidth`    | Tree area width                                        |
| `treeWidth`        | Tree width                                             |
| `drawNodeBubbles`  | Show node bubbles on tree                              |
| `labelsAlignRight` | Align labels to the right                              |
| `showBranchLen`    | Show branch lengths                                    |
| `querySeqName`     | Name for query sequence                                |
| `highlightColumns` | Visible column indices to highlight on open            |

### Building an alignment from a gene: `orthologParams`

This is the launch dialog's **Orthologs (fast)** tab reached declaratively, so a
link can say "NLRP1 across species" and the view builds it. Two of its fields
default so that a spec stays short.

| Field                | Required | Description                                                         |
| -------------------- | -------- | ------------------------------------------------------------------- |
| `taxId`              | Yes      | NCBI taxon id of the assembly the query gene came from              |
| `geneCandidates`     | Yes      | Gene identifiers, tried in order until one resolves                 |
| `msaAlgorithm`       | Yes      | `clustalo`, `muscle`, `kalign` or `mafft`                           |
| `taxa`               | No       | Taxon ids to include. Omitted means every species the dialog offers |
| `proteinSequence`    | No       | The QUERY row. Omitted means NCBI's representative protein          |
| `selectedTranscript` | No       | The transcript the query row was translated from                    |

`proteinSequence` is what the launch dialog always supplies, translated from the
transcript the user picked, because that is the row `connectedFeature` maps
genome coordinates through. A spec naming a gene has no transcript to translate
and should not have to carry ~1.5 kB of residues in a url, so it gets NCBI's
representative protein instead, which is also the choice every other row makes.
A query row taken from the representative additionally passes the byte-identity
test that attaches its `Accession`, so the CDD domain overlay is there by
construction.

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

1. **Orthologs (fast)**: look up NCBI's precomputed ortholog gene per species
   and align what comes back. No search job to queue, so this returns in seconds
2. **NCBI BLAST query**: submit the protein sequence to NCBI BLAST and align the
   hits. The route for a gene with no resolvable symbol
3. **Pre-loaded MSA datasets**: use pre-calculated alignments from configuration
4. **Manual upload**: load MSA/tree files directly

Each launch method automatically sets up the genome view connection for
coordinate mapping and highlighting.

Only the first is reachable without the dialog, via `orthologParams` above.

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
