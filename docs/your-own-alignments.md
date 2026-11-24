# Opening your own alignments

The plugin renders any alignment you made, from a curated family, a Pfam seed or
your own pipeline, and connects it to the genome like a built one. Formats are
FASTA with gaps inserted, Stockholm (multi-Stockholm and embedded Newick
included) and Clustal; a tree may also be a separate Newick file.

## From the gene: Manual upload

Right-click a gene, launch an MSA view and open **Manual upload** to pick an
alignment and optionally a tree, from a file or a URL. The dialog finds the
gene's protein row by comparing residues, not names, since aligners rename the
query. A row covering only part of the protein is fine: the dialog records how
many residues it starts in.

### Where a pasted or uploaded alignment is kept

react-msaview drops any document over 50 kB from the session snapshot, so a
document read from a local file or pasted in is kept in the browser's IndexedDB
(`jbrowse-msaview-data`), with a `dataStoreId` in the session. Entries no
session has opened for seven days are cleaned up. A URL alignment needs none of
this.

Such a session reopens in the same browser only; a shared link finds nothing
behind the reference. To share, host the file and load it by URL.

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
row starts partway into the protein, `querySeqOffset` gives the transcript
residues before its first one, or the mapping is off by that many codons. The
server hosting the files must send `Access-Control-Allow-Origin`.
[Launching](launching.md) covers `highlights`, `region`, `columnTracks` and
placement.

## A dataset for every gene

A site can offer a set of alignments, one per gene or transcript, in the
dialog's **Pre-loaded MSA datasets** tab. List them under `msa.datasets` in the
config:

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
          "uri": "https://jbrowse.org/demos/msaview/100way/hg38.knownCanonical.multiz100way.aa.fa.gz"
        }
      }
    ]
  }
}
```

The file is a bgzipped FASTA with each alignment's rows together, a `.gzi`
(`bgzip -i` writes it) and an `.idx` beside it. The `.idx` has one line per
alignment: its name, uncompressed byte offset and length. The dialog lists the
set from it and reads a chosen alignment as one block. For UCSC's 100-way that
is a 211 kB list and a ~70 kB read, where the `.fai` is 91 MB. The adapter looks
for `<uri>.idx`; `msaIndexLocation` names one kept elsewhere.

The dialog offers an alignment when its name equals the transcript's id, `name`,
`transcript_id` or `gene_name`, so a set keyed by gene symbol serves every
isoform.

Without an `.idx` the adapter falls back to the `.fai` and groups rows by the
part of the name before the first `_` (`msaRegex` changes the separator), with
the query row defaulting to `<transcriptId>_<assembly>`. That suits a few
hundred alignments; at genome scale the `.fai` is the slow part.

### Writing the `.idx`

For a FASTA named that way, with each alignment's rows together, this writes the
`.idx` from the uncompressed file:

```sh
bgzip -dc genes.fa.gz | LC_ALL=C awk '
  /^>/ { id = substr($0, 2); sub(/_.*/, "", id)
         if (id != cur) { if (cur != "") print cur "\t" start "\t" pos - start
                          cur = id; start = pos + 0 } }
  { pos += length($0) + 1 }
  END { print cur "\t" start "\t" pos - start }' > genes.fa.gz.idx
```

Row names need not carry the alignment's name if the `.idx` says which gene each
block is: the 100-way file names rows by assembly alone.

## An OrthoFinder run

[OrthoFinder](https://github.com/OrthoFinder/OrthoFinder) already writes an
alignment and a gene tree for each orthogroup it finds across your proteomes.
Put the `Results_*` folder it produced on a static web server and name it as a
dataset:

```json
{
  "msa": {
    "datasets": [
      {
        "datasetId": "orthofinder",
        "name": "Orthogroups",
        "description": "OrthoFinder 3.2 over our twelve assemblies",
        "adapter": {
          "type": "OrthoFinderMsaAdapter",
          "resultsLocation": {
            "uri": "https://example.org/orthofinder/Results_Nov05/"
          }
        }
      }
    ]
  }
}
```

Upload the `Orthogroups/`, `MultipleSequenceAlignments/` and
`Resolved_Gene_Trees/` folders as OrthoFinder wrote them; nothing is converted
and `WorkingDirectory/` is not read. The server must send
`Access-Control-Allow-Origin`.

- OrthoFinder 3 writes the alignments by default, 2 only with `-M msa`, and
  `-og` stops either before them.
- Run with `-z`: without it OrthoFinder trims mostly-gap columns, taking
  residues out of the rows, and the dialog can no longer find the gene's row or
  map a column to its codon.
- Both releases' tree layouts are read. Orthogroups under four genes open
  without a tree, and the few OrthoFinder does not align say so in the dialog.

The link to the genome is the protein's name, looked up in the `Orthogroups.tsv`
column named after the genome view's assembly, so name each proteome file after
its assembly (`melanogaster.fa`). Without such a column every species is
searched, and a name two species share can open the other's orthogroup.

The dialog offers a transcript when OrthoFinder's name for the protein (the
first word of its FASTA header) is the transcript's id, `name`, `transcript_id`,
`locus_tag` or CDS `protein_id`, or its gene's `ID` without `gene-` or `gene:`.
It ignores a trailing `.N` version and undoes OrthoFinder's `_` rewriting of
whitespace and `: ; ( ) , [ ] = ' "` (`zgc:86896` is `zgc_86896`). Usual
proteomes line up with their GFF3:

- `gffread -y proteins.fa -g genome.fa annotation.gff3` names each protein by
  its transcript id
- NCBI's and Ensembl's protein files name it by `protein_id`
- One protein per gene renamed to the gene id, as the
  [OrthoFinder synteny tutorial](https://jbrowse.org/jb2/docs/tutorials/orthofinder_synteny/)
  builds them, matches through the gene

Rows are named `<species>_<protein>` (`melanogaster_Dmel_CG2671`), and the
dialog starts on the clicked protein's own row.

## One file read by gene: `msaIndexedLocation`

For a genome-scale set behind a link rather than a dialog, `msaIndexedLocation`
random-reads one alignment out of the same kind of file:

```
{"type":"MsaView","msaIndexedLocation":{"uri":"https://example.org/genes.fa.gz"},"msaName":"TP53",
 "connectedViewId":"lgv1","connectedTranscript":"ENST00000269305.9","querySeqName":"hg38"}
```

Beside `genes.fa.gz` the plugin expects `genes.fa.gz.gzi` and `genes.fa.gz.idx`,
found by suffix. It fetches the `.idx` once, looks up `msaName` ignoring any
trailing version, and reads just that block, which is already plain FASTA. One
file then serves every gene with no per-gene files or coordinates.
