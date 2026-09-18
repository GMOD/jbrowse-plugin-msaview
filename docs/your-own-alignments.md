# Opening your own alignments

The plugin builds alignments from ortholog services and searches, but it renders
any alignment you made yourself — from a curated family, a Pfam seed, a
genome-scale multiz, or your own pipeline — and connects it to the genome the
same way. What changes is who supplies the file: you, a link, or the site's
config.

Alignments may be FASTA with gaps already inserted, Stockholm (including a
multi-Stockholm file and an embedded Newick tree) or Clustal; a tree may also
come separately as a Newick file.

## From the gene: Manual upload

Right-click a gene, launch an MSA view, and open the **Manual upload** tab to
pick an alignment and optionally a tree, from a file or a URL. The dialog finds
the row that is the gene's protein by comparing residues against the translated
transcript, not by name, since aligners rename the query on the way through. A
row that covers only part of the protein is fine: the dialog records how many
residues it starts in, and the genome mapping accounts for it.

### Where a pasted or uploaded alignment is kept

react-msaview strips large inline data from session snapshots, so the plugin
keeps an alignment loaded from pasted text or a local file in the browser's
IndexedDB (database `jbrowse-msaview-data`) and saves only a reference id,
`dataStoreId`, in the session. On reload the plugin reads the alignment, tree
and tree metadata back from there, and cleans up entries no session has opened
for seven days.

The consequence: a session holding an uploaded alignment reopens in the same
browser, but a shared link or another machine finds nothing behind the
reference. To share it, host the file and load it by URL, which needs no storage
at all.

## From a link

Name the file in a session spec, and connect it to a genome view to get the
column-to-codon mapping:

```
session=spec-{"views":[
  {"type":"LinearGenomeView","id":"lgv1","assembly":"hg38","loc":"chr17:7,661,779-7,687,538","tracks":["hg38-ncbiRefSeqSelect"]},
  {"type":"MsaView","placement":"splitRight",
   "msaFileLocation":{"uri":"https://example.org/p53-family.afa"},
   "treeFileLocation":{"uri":"https://example.org/p53-family.nh"},
   "connectedViewId":"lgv1","connectedTranscript":"NM_000546.6","querySeqName":"Human"}
]}
```

A link has no dialog to find the query row, so `querySeqName` names it. If that
row starts partway into the protein, `querySeqOffset` says how many transcript
residues come before its first one; without it the genome mapping is off by that
many codons. The browser fetches the files itself, so the server hosting them
has to send `Access-Control-Allow-Origin`. [Launching](launching.md) covers
`highlights`, `region`, `columnTracks` and placement for such a link.

## A dataset for every gene

A site can offer a set of alignments, one per transcript, in the dialog's
**Pre-loaded MSA datasets** tab. List them under `msa.datasets` in the config:

```json
{
  "msa": {
    "datasets": [
      {
        "datasetId": "ucsc_100way",
        "name": "UCSC 100-way",
        "description": "Protein alignments from UCSC's multiz100way",
        "adapter": {
          "type": "BgzipFastaMsaAdapter",
          "uri": "https://jbrowse.org/demos/knownCanonical.multiz100way.protAA.fa.gz"
        }
      }
    ]
  }
}
```

The file is a bgzipped FASTA with its `.fai` and `.gzi` beside it
(`samtools faidx` on a `bgzip`ped file writes both), holding every alignment's
rows. The part of a sequence name before the first `_` names the alignment it
belongs to, so `ENST00000269305.9_hg38` and `ENST00000269305.9_panTro4` are two
rows of one alignment. `msaRegex` on the adapter changes that separator. The
dialog offers an alignment when that name equals the transcript's id, `name` or
`transcript_id` exactly, version included, and finds the query row by residues,
falling back to `<transcriptId>_<assembly>`.

## One file read by transcript: `msaIndexedLocation`

For a genome-scale set behind a link rather than a dialog, `msaIndexedLocation`
random-reads one transcript's alignment out of a single bgzip file:

```
{"type":"MsaView","msaIndexedLocation":{"uri":"https://example.org/genes.fa.gz"},"msaName":"ENST00000269305",
 "connectedViewId":"lgv1","connectedTranscript":"ENST00000269305.9","querySeqName":"hg38"}
```

Beside `genes.fa.gz` the plugin expects `genes.fa.gz.gzi`, the bgzip index, and
`genes.fa.gz.idx`, a TSV of `name`, uncompressed byte offset and length for each
alignment's block. It fetches the small `.idx` once, looks up `msaName` ignoring
any trailing version, and reads just that block, which is already plain FASTA.
One file then serves every gene with no per-gene files or coordinates.
react-msaview's `scripts/gene-explorer/build-data.mjs` builds such a file from
UCSC's multiz alignments, and is the model for building one from your own.
