# Launching an MSA view from a URL or from code

The plugin registers a `LaunchView-MsaView` extension point, which JBrowse calls
for every `MsaView` entry in a
[session spec](https://jbrowse.org/jb2/docs/urlparams/#session-spec). So a link
can open an alignment, connect it to a genome view, point at a residue and put
the view where it belongs, with no clicking. [Parameters](#parameters) lists
every argument.

## An alignment on its own

```
https://jbrowse.org/code/jb2/main/?config=config.json&session=spec-{"views":[{"type":"MsaView","msa":"https://example.com/alignment.fa"}]}
```

`msa` takes the url of a FASTA, Stockholm or Clustal file, and `tree` a Newick
tree's. Either also takes the text itself. `msaFileLocation` and
`treeFileLocation` are the long forms, and [parameters](#short-forms) lists the
other short ones. [Your own alignments](your-own-alignments.md) covers the other
ways to hand the view an alignment you made.

## Connected to the genome: `connectedTranscript`

A connected alignment maps each column through the query row's residue to its
codon, so a hover in the alignment lights the codon on the genome and the other
way round. The mapping runs through the transcript's exon model,
`connectedFeature`, ~1.5 kB of coordinates a person cannot type.
`connectedTranscript` is its short form: a transcript id (`NM_000546.6`, version
optional) that the view looks up in the connected genome view's open tracks once
that view has loaded. The genome view has to be on the gene's locus with a gene
track open, which is what a spec pinning its `id` already does.

```
session=spec-{"views":[
  {"type":"LinearGenomeView","id":"lgv1","assembly":"hg38","loc":"chr17:7,668,000-7,688,000","tracks":["hg38-ncbiRefSeqCurated"]},
  {"type":"MsaView","connectedViewId":"lgv1","connectedTranscript":"NM_000546.6","placement":"splitRight",
   "orthologParams":{"taxId":9606,"geneCandidates":["TP53"],"source":"uniref","msaAlgorithm":"browser"}}
]}
```

For an alignment file, also name the row that is the transcript's protein with
`query` (long form `querySeqName`). For an `orthologParams` or `searchParams`
launch that names no `proteinSequence`, the translated transcript becomes the
query row.

A lookup that misses, or cannot run because the genome view is absent or has no
gene track open, ends a search or ortholog launch with an error naming what is
missing. Beside an alignment from anywhere else it is a notice instead, and the
alignment opens unlinked ([notices](#notices)).

List the genome view before the MsaView. A spec launches its views in order and
the host gives no sign a spec is still being applied, so an MsaView launched
first shows `No view with id "lgv1" is open` as its error until the genome view
arrives, then clears it. It heals itself, but a screenshot taken in between
shows the error. The view does not wait: with no spec-in-progress signal, a wait
could only be timed or unbounded, and unbounded would hang on a mistyped id.

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

[Linked views](linked-views.md) explains how the columns reach the genome and a
protein3d structure.

## Pointing at a residue: `highlights`

A link that is about one residue should say so in that residue's own numbering.
With a `query` row, `175` highlights that row's residue 175 and labels it from
the sequence ("R175"), and `"339-350 NES"` highlights a labeled range. The long
form takes 1-based inclusive ranges: `{row, start, end}` for residues of the
named row, `{start, end}` for alignment columns, `{rows: [...]}` for whole rows,
each with an optional `label` and `color`. The viewer projects a residue range
through the alignment's gaps, so it lands on the same residues whatever
`allowedGappyness` hides, where `highlightColumns` names visible column indices
that shift with it.

```
session=spec-{"views":[{
  "type": "MsaView",
  "msa": "https://.../tp53-p53-orthologs.fa",
  "query": "human",
  "highlights": ["339-350 NES"]
}]}
```

A connected protein3d view still lights the alignment through the volatile
highlighted-columns channel, so its hover and click draw on top of these and
never replace them. `columnTracks` follows the same contract for per-column
numbers or a text row; react-msaview's `docs/layers.md` documents both fields.

## Opening on a residue: `region`

`region` takes the same 1-based inclusive coordinates as `highlights`. The view
zooms onto it once the alignment and any tree file have loaded, then drops the
key, so a reloaded session opens wherever the reader left it. A plugin release
older than the one that shipped `region` ignores the key and opens at column 0.

```
session=spec-{"views":[{
  "type": "MsaView",
  "msa": "https://.../tp53-p53-orthologs.fa",
  "query": "human",
  "highlights": [248],
  "region": "230-290"
}]}
```

## Where the view lands: `placement`

A launch can state its arrangement: `stack` (the default, and what every link
written before this key does), `splitRight` or `newTab`. Anything but `stack`
needs a host with tiled workspaces (jbrowse-web or desktop, v5 and later) and
turns workspaces on for that session only; elsewhere the view stacks and says so
in the console. The launch **dialog** defaults to `splitRight`, remembered per
browser, since a launch from a gene carries `connectedViewId` and the pair reads
as a left/right split.

```
session=spec-{"views":[
  {"type":"LinearGenomeView","id":"lgv1","assembly":"hg38","loc":"chr1:100-200"},
  {"type":"MsaView","connectedViewId":"lgv1","placement":"splitRight",
   "msaFileLocation":{"uri":"https://example.com/alignment.fa"}}
]}
```

For anything richer than "this view, over there", state the whole arrangement
with the host's own
[`layout`](https://jbrowse.org/jb2/docs/urlparams/#tiled-views--workspaces) key,
a tree of panels and sizes applied once every view in the spec has launched:

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

## The gallery's first link, taken apart

The link opens three views on jbrowse.org's hg38 hub config, which already loads
this plugin and jbrowse-plugin-protein3d:

- a genome view pinned as `lgv1` on exon 7 of TP53 with only RefSeq Select open,
  which is where the transcript lookup finds `NM_000546.6`. ClinVar stays out of
  it: across a whole gene it draws "too many features" or a wall of variants,
  while the per-residue ClinVar track in the MSA says which positions carry them
- an MSA view of the vertebrate p53 alignment hosted at
  `gmod.org/JBrowseMSA/demo/data/p53/`, connected to `lgv1` through
  `connectedTranscript`, with `query: "Human"`, the DNA-binding domain and six
  hotspots as `highlights` (`175` draws as "R175"), a `region` on the hotspots,
  and ClinVar, AlphaMissense and MaveDB per-residue scores as `columnTracks`.
  Each track's `start` skips its leading zeros. react-msaview's
  [p53 tutorial](https://github.com/GMOD/react-msaview/blob/main/docs/tutorials/p53_variant_effects.md)
  builds those numbers and is the recipe for tracks of your own
- a ProteinView of AlphaFold's P04637 model, connected to the same genome view
  by `transcriptId`

The alignment's Human row is P04637's canonical sequence, which is what
NM_000546.6 translates to, so the three views share one coordinate map. The
second figure is a UniRef launch of HBB with `domainsOnGenome`. The spec is
`encodeURIComponent` with `,:[]{}/` put back, and `(` and `)` escaped so the
Markdown link survives; escaping everything takes the URL past the 8 kB request
line the host accepts.

## From code

```typescript
pluginManager.evaluateExtensionPoint('LaunchView-MsaView', {
  session,
  data: { msa: clustalOutput, tree: newickTree },
  displayName: 'My MSA',
  residueColor: { scale: { scheme: 'percent_identity_dynamic' } },
})
```

The extension point throws when no source is given.

## Parameters

Every argument the `LaunchView-MsaView` extension point takes, in a session spec
entry or from code.

### Sources

Exactly one source is required. The first three name an alignment that already
exists; `orthologParams` and `searchParams` name no alignment at all and build
one at launch ([alignments from a gene](alignments-from-a-gene.md)).

| Source               | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `msa`                | a url, or the alignment text itself when it spans more than one line     |
| `data`               | `{ msa: string, tree?: string }`                                         |
| `msaFileLocation`    | `{ uri: string }` for an MSA file                                        |
| `msaIndexedLocation` | `{ uri: string }` for a name-indexed bgzip alignment; needs `msaName`    |
| `orthologParams`     | build the alignment from a precomputed ortholog or UniRef set, see below |
| `searchParams`       | build the alignment from a similarity search, see below                  |

### Everything else

| Parameter             | Description                                                            |
| --------------------- | ---------------------------------------------------------------------- |
| `msaName`             | The entry of an `msaIndexedLocation` to read, usually a transcript id  |
| `tree`                | a Newick url, or the Newick text itself when it starts with `(`        |
| `treeFileLocation`    | `{ uri: string }` for a Newick tree file                               |
| `query`               | The row the spec is about, see [short forms](#short-forms)             |
| `connectedViewId`     | ID of the connected LinearGenomeView                                   |
| `connectedFeature`    | The transcript feature columns map to the genome through               |
| `connectedTranscript` | A transcript id looked up in the connected view instead                |
| `querySeqName`        | The row that is the connected transcript's protein                     |
| `querySeqOffset`      | Transcript residues before that row's first residue, for a trimmed row |
| `domainsOnGenome`     | Add the query row's domains to the connected genome view once loaded   |
| `zoomToBaseLevel`     | A column click zooms the genome view to the codon, not only centers it |
| `uniprotId`           | The query's UniProt accession, for `report`; an AlphaFold url sets it  |
| `mafRegion`           | Genome bases a MAF query row spans, columns mapping base for base      |
| `embeddedMode`        | `false` for the labeled toolbar; the default draws its menus as icons  |
| `displayName`         | Custom view display name                                               |
| `residueColor`        | Cell color, e.g. `{scale: {scheme: 'percent_identity_dynamic'}}`       |
| `colWidth`            | Column width in pixels                                                 |
| `rowHeight`           | Row height in pixels                                                   |
| `allowedGappyness`    | Hide any column gappier than this percent, 100 to keep                 |
| `treeAreaWidth`       | Tree area width; unset fits the labels and the tree                    |
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

### `orthologParams`

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

### `searchParams`

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

### Short forms

The extension point runs every entry through react-msaview's `expandSpec`, so a
spec can use the short forms its
[`docs/layers.md`](https://github.com/GMOD/react-msaview/blob/main/docs/layers.md#shorthand)
lists, and the long forms above keep working.

| Short form                 | Means                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `msa`, `tree`              | a url, or the text itself; a url still goes through `msaFileLocation`                     |
| `query: "Human"`           | `querySeqName` and `relativeTo`, and the default `row` of highlights, `region` and tracks |
| a highlight `175`          | residue 175 of the query row, labeled from the sequence: "R175"                           |
| a highlight `"102-292 DB"` | residues 102-292 of the query row, labeled "DB"                                           |
| `region: "170-290"`        | residues 170-290 of the query row                                                         |
| a column track             | `id` from `name`, `kind` from `values`/`data`/`arcs`, `start` for an offset               |

`"row": null` on an object entry puts it back on alignment columns. A host whose
store serves an older plugin release ignores the short forms.

## Reading the result

A launch makes choices nobody wrote down: which search ran, how many rows came
back, whether the query row was found, whether the columns reach the genome. The
header and the warning chip show them to a reader; a script or an agent reads
the same things as plain JSON off an open MsaView (`session.views` or
`jb.view(viewId)`). The example is three HBB proteins beside GENCODE's HBB-201
on hg38, launched with `domainsOnGenome`.

### `view.report`

```js
await jb.waitReady(60000)
const view = jb.view(viewId)
return view.report
```

```jsonc
{
  "loading": false,
  "notices": [],
  "source": { "kind": "inline" },
  "rows": 3,
  "columns": 147,
  "domainAnnotations": 81,
  "queryRow": { "name": "Human", "found": true, "offset": 0 },
  "connection": {
    "viewId": "lgv1",
    "viewOpen": true,
    "transcript": "HBB-201",
    "refName": "chr11",
    "mapped": true,
  },
}
```

- `loading` is the view's `showLoading`, which the ready marker reads: true
  while a launch runs, stored or linked data loads, `connectedTranscript` is
  being looked up, the protein domains are being fetched, or a `domainsOnGenome`
  track waits on its genome view. Each of those ends on failure too, so
  `loading` never outlasts the work. The domain fetch asks NCBI for 100 proteins
  at a time and gives each request 30 s, about fifteen times a normal answer;
  one that runs out ends the fetch with the failure notice below, keeping the
  batches already answered. A stalled NCBI holds `loading` 30 s, and the domains
  hold it at most 30 s per 100 uncached proteins.
- `error` is set only when the view cannot show an alignment at all: a launch
  that failed, an alignment that is gone from browser storage, a file that did
  not parse. It is the error's message.
- `notices` lists what failed and left the alignment working, the messages the
  header's warning chip shows. Dismissing the chip clears them until their cause
  changes. A notice does not end `loading`.
- `source.kind` is `blastp`, `phmmer`, `orthologs`, `url`, `indexed`, `file`,
  `inline` or `none`. A search adds its `database`, `msaAlgorithm`, `maxHits`,
  `accession`, `queryLength`, `completed` and the EBI `jobId` while one is
  known; an ortholog launch its `orthologSource`, `taxId`, `identity`,
  `maxSpecies`, `taxa`, `geneCandidates` and `msaAlgorithm`.
- `rows` counts every sequence in the alignment, rows a collapsed clade hides
  included; `columns` is its width before any are hidden.
- `queryRow.found` says whether `querySeqName` names a row; `offset` is
  `querySeqOffset`.
- `connection` is absent for a view linked to nothing. `mapped` is whether a
  column reaches the genome, and `unmappedBecause` says why not when it does
  not: the lookup is still running or missed, the genome view is not open, the
  transcript has no usable CDS, no alignment is loaded yet, or no row has the
  query's name.

### Notices

These reach `notices` rather than `error`, because the alignment is still worth
reading without them:

- `connectedTranscript` could not be resolved, for an alignment that does not
  depend on it (a file, inline data, an indexed alignment). A search or ortholog
  launch waiting on the transcript for its query cannot run, so there the same
  message is the view's `error`.
- The linked transcript does not map to the genome, with the reason: no CDS, no
  strand, a CDS spanning a chromosome.
- `querySeqName` names no row of a linked alignment.
- The protein domains failed to load from NCBI, or loaded for some rows only.
- What a launch left out, such as species names NCBI did not answer for, and
  parts of a stored view that expired from browser storage.

A lookup that cannot start says what is missing rather than waiting: no
`connectedViewId`, no view with that id, an id naming a view that is not a
genome view (a ProteinView, another MsaView), a genome view that failed to load,
or one with no feature track open. A genome view still loading its assembly or
opening the tracks its own launch names is waited for. The connection recovers
by itself when what was missing arrives: a genome view added after the MsaView,
or a gene track opened later.
