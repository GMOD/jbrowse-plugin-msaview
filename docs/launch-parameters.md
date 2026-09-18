# Launch parameters

Every argument the `LaunchView-MsaView` extension point takes, in a session spec
entry or from code. [Launching](launching.md) walks through them with working
links.

## Sources

Exactly one source is required. The first three name an alignment that already
exists; `orthologParams` and `searchParams` name no alignment at all and build
one at launch ([alignments from a gene](alignments-from-a-gene.md)).

| Source               | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `data`               | `{ msa: string, tree?: string }`                                         |
| `msaFileLocation`    | `{ uri: string }` for an MSA file                                        |
| `msaIndexedLocation` | `{ uri: string }` for a name-indexed bgzip alignment; needs `msaName`    |
| `orthologParams`     | build the alignment from a precomputed ortholog or UniRef set, see below |
| `searchParams`       | build the alignment from a similarity search, see below                  |

## Everything else

| Parameter             | Description                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| `msaName`             | The entry of an `msaIndexedLocation` to read, usually a transcript id  |
| `treeFileLocation`    | `{ uri: string }` for a Newick tree file                               |
| `connectedViewId`     | ID of the connected LinearGenomeView                                   |
| `connectedFeature`    | The transcript feature columns map to the genome through               |
| `connectedTranscript` | A transcript id looked up in the connected view instead                |
| `querySeqName`        | The row that is the connected transcript's protein                     |
| `querySeqOffset`      | Transcript residues before that row's first residue, for a trimmed row |
| `displayName`         | Custom view display name                                               |
| `colorSchemeName`     | Color scheme (e.g. 'percent_identity_dynamic')                         |
| `colWidth`            | Column width in pixels                                                 |
| `rowHeight`           | Row height in pixels                                                   |
| `allowedGappyness`    | Hide any column gappier than this percent, 100 to keep                 |
| `treeAreaWidth`       | Tree area width                                                        |
| `treeWidth`           | Tree width                                                             |
| `drawNodeBubbles`     | Show node bubbles on tree                                              |
| `labelsAlignRight`    | Align labels to the right                                              |
| `showBranchLen`       | Show branch lengths                                                    |
| `highlightColumns`    | Visible column indices to highlight on open                            |
| `highlights`          | Labeled residue, column, or row highlights                             |
| `region`              | Residues or columns to open zoomed onto                                |
| `columnTracks`        | Per-column tracks supplied as data (bar values or a text row)          |
| `placement`           | Where the view lands: `stack` (default), `splitRight`, `newTab`        |

`clades`, `encodings`, `rowPanels`, `relativeTo`, `residueMappings`,
`trackHeights`, `turnedOffFeatures`, `gffFilehandle` and
`treeMetadataFilehandle` pass through untouched as react-msaview snapshot
properties; react-msaview's `docs/layers.md` documents them.

Write every argument directly on the view entry. The MsaView model keeps the
sources that need resolving at launch (`msaFileLocation`, `msaIndexedLocation`)
in an internal `init` property that the extension point fills in, so a spec
never names `init` itself. The same holds for the genome view beside it: JBrowse
5 deprecates the `init` nesting JBrowse 4's LinearGenomeView used, so write its
`assembly`, `loc` and `tracks` flat, as every example here does.

## `orthologParams`

| Field                    | Required | Description                                                      |
| ------------------------ | -------- | ---------------------------------------------------------------- |
| `taxId`                  | Yes      | NCBI taxon id of the assembly the query gene came from           |
| `geneCandidates`         | Yes      | Gene identifiers, tried in order until one resolves              |
| `msaAlgorithm`           | Yes      | `clustalo`, `muscle`, `kalign`, `mafft` or `browser`             |
| `taxa`                   | No       | Taxon ids to include. Omitted means every species the source has |
| `maxSpecies`             | No       | Rows to align, 100 when omitted                                  |
| `proteinSequence`        | No       | The QUERY row. Omitted means the source's representative protein |
| `selectedTranscript`     | No       | The transcript the query row was translated from                 |
| `source`                 | No       | `ncbi` (the default), `panther` or `uniref`                      |
| `identity`               | No       | UniRef only: `50` (the default) or `90`                          |
| `referenceProteomesOnly` | No       | UniRef only: keep reference-proteome members, `true` by default  |

## `searchParams`

| Field           | Required | Description                                                          |
| --------------- | -------- | -------------------------------------------------------------------- |
| `searchProgram` | No       | `phmmer` or `blastp` (the default)                                   |
| `blastDatabase` | Yes      | a database of that program's, see `consts.ts`                        |
| `accession`     | No       | UniProt accession to fetch the query from                            |
| `maxHits`       | No       | hits to keep, 100 when omitted                                       |
| `msaAlgorithm`  | blastp   | the aligner for blastp's hits, `browser` included; phmmer needs none |

The query comes from `proteinSequence`, else is fetched for `accession`, else is
translated from the view's `connectedTranscript`. The name `searchParams` is the
spec's; the model stores it as `blastParams`, the name the dialog has always
used.

## `highlights` and `region`

Both take 1-based inclusive ranges: `{row, start, end}` for residues of the
named row, `{start, end}` for alignment columns. `highlights` also takes
`{rows: [...]}` for whole rows, and each entry an optional `label` and `color`.

## `placement`

| Value        | Effect                                                              |
| ------------ | ------------------------------------------------------------------- |
| `stack`      | append below whatever is on screen. The default                     |
| `splitRight` | its own cell to the right, so a connected genome view stays visible |
| `newTab`     | its own tab in the current cell, a click away from the rest         |
