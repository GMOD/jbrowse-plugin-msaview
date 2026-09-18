# Launching an MSA view from a URL or from code

The plugin registers a `LaunchView-MsaView` extension point, which JBrowse calls
for every `MsaView` entry in a
[session spec](https://jbrowse.org/jb2/docs/urlparams/#session-spec). So a link
can open an alignment, connect it to a genome view, point at a residue and put
the view where it belongs, with no clicking.
[Launch parameters](launch-parameters.md) lists every argument.

## An alignment on its own

```
https://jbrowse.org/code/jb2/main/?config=config.json&session=spec-{"views":[{"type":"MsaView","msaFileLocation":{"uri":"https://example.com/alignment.fa"}}]}
```

`msaFileLocation` takes FASTA, Stockholm or Clustal, and `treeFileLocation` a
Newick tree. [Your own alignments](your-own-alignments.md) covers the other ways
to hand the view an alignment you made.

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
`querySeqName`. For an `orthologParams` or `searchParams` launch that names no
`proteinSequence`, the translated transcript becomes the query row.

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
numbers or a text row; react-msaview's `docs/layers.md` documents both fields.

## Opening on a residue: `region`

`region` takes the same 1-based inclusive coordinates as `highlights`. The view
zooms onto it once the alignment and any tree file have loaded, then drops the
key, so a reloaded session opens wherever the reader left it. A plugin release
older than the one that shipped `region` ignores the key and opens at column 0.

```
session=spec-{"views":[{
  "type": "MsaView",
  "msaFileLocation": {"uri": "https://.../tp53-p53-orthologs.fa"},
  "querySeqName": "human",
  "highlights": [{"row": "human", "start": 248, "end": 248, "label": "R248"}],
  "region": {"row": "human", "start": 230, "end": 290}
}]}
```

## Where the view lands: `placement`

A launch states its arrangement instead of leaving the reader to drag the view
into place: `stack`, `splitRight` or `newTab`. Anything other than `stack` needs
a host with tiled workspaces (jbrowse-web or desktop, v5 and later), and turns
workspaces on for that session while leaving the visitor's own default
untouched. An embedded session, or a release that places views its own way,
stacks and says so in the console.

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

## The README demo, taken apart

The README's p53 link opens three views on jbrowse.org's hg38 hub config, which
already loads this plugin and jbrowse-plugin-protein3d:

- a genome view pinned as `lgv1` on TP53 with only RefSeq Select open, which is
  where the transcript lookup finds `NM_000546.6`. ClinVar stays out of it:
  across 25 kb it draws "too many features" or an undifferentiated wall of
  variants, while the per-residue ClinVar column in the MSA says which positions
  carry them
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

## From code

```typescript
pluginManager.evaluateExtensionPoint('LaunchView-MsaView', {
  session,
  data: { msa: clustalOutput, tree: newickTree },
  displayName: 'My MSA',
  colorSchemeName: 'percent_identity_dynamic',
})
```

The extension point throws when no source is given.
