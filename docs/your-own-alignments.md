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

react-msaview drops any document over 50 kB from the session snapshot, and a
document read from a local file or pasted in has nowhere else to come back from.
The plugin keeps exactly those documents -- alignment, tree, row metadata or
annotations -- in the browser's IndexedDB (database `jbrowse-msaview-data`) and
saves a reference id, `dataStoreId`, in the session. A document loaded from a
URL needs none of this, so a URL alignment with a large local GFF on top keeps
only the GFF. On reload the plugin reads them back, and cleans up entries no
session has opened for seven days.

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

The file is a bgzipped FASTA holding every alignment's rows, each alignment's
rows written together, with a `.gzi` and an `.idx` beside it. `bgzip -i` writes
the `.gzi`. The `.idx` names each alignment and gives its uncompressed byte
offset and length, one line per alignment, so the dialog lists the set from it
and reads a chosen alignment as one block. For UCSC's 100-way that is a 211 kB
list and one ~70 kB read, where the per-row `.fai` the adapter would otherwise
read is 2M lines and 91 MB. The adapter looks for `<uri>.idx` the way the host
looks for `<uri>.fai`; `msaIndexLocation` names one kept elsewhere.

The dialog offers an alignment when its name equals the transcript's id, `name`,
`transcript_id` or `gene_name` exactly, so a set keyed by gene symbol serves
every isoform of the gene, and finds the query row by residues.

Without an `.idx` the adapter falls back to the `.fai` (`samtools faidx` on a
bgzipped file writes it and the `.gzi`), and groups rows into alignments by
name: the part before the first `_` names the alignment, so
`ENST00000269305.9_hg38` and `ENST00000269305.9_panTro4` are two rows of one
alignment. `msaRegex` on the adapter changes that separator, and the query row
falls back to `<transcriptId>_<assembly>`. That suits a set of a few hundred
alignments; at genome scale the `.fai` is the slow part.

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

A row name need not carry the alignment's name at all if the `.idx` is written
some other way: the 100-way file's rows are named by assembly alone (`hg38`,
`panTro4`), and only its `.idx` says which gene each block is.

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
and `WorkingDirectory/` is not read. As with any hosted file, the server must
send `Access-Control-Allow-Origin`.

OrthoFinder 3 writes the alignments by default, OrthoFinder 2 only with
`-M msa`, and `-og` stops either before them. Both releases' tree layouts are
read: 3's single `Resolved_Gene_Trees.txt` and 2's file per orthogroup.
Orthogroups of fewer than four genes open as an alignment without a tree, and
the few OrthoFinder does not align (111 of 13,333 over five flies) say so in the
dialog.

The link to the genome is the protein's name, looked up in the column of
`Orthogroups.tsv` named after the genome view's assembly, so name each proteome
file after its assembly (`melanogaster.fa` for the assembly `melanogaster`).
Without such a column every species is searched, and a name two species share,
as NCBI's gene symbols often are, can open the other species' orthogroup.

OrthoFinder names each protein by the first word of its FASTA header, and the
dialog offers a transcript when that name is the transcript's id, `name`,
`transcript_id`, `locus_tag` or CDS `protein_id`, or else its gene's `ID` with
NCBI's `gene-` or Ensembl's `gene:` dropped. It ignores a trailing `.N` version
on the proteome's side, and matches a name OrthoFinder rewrote: OrthoFinder
writes `_` for each whitespace, `: ; ( ) , [ ] = ' "`, so zebrafish's
`zgc:86896` is `zgc_86896` in its results. Any of the usual proteomes lines up
with the GFF3 it came from:

- `gffread -y proteins.fa -g genome.fa annotation.gff3` names each protein by
  its transcript id.
- NCBI's and Ensembl's downloaded protein files name it by `protein_id`.
- One protein per gene renamed to the gene id, as the
  [OrthoFinder synteny tutorial](https://jbrowse.org/jb2/docs/tutorials/orthofinder_synteny/)
  builds them, matches through the gene.

The alignment names each row `<species>_<protein>` (`melanogaster_Dmel_CG2671`),
and the dialog starts on the clicked protein's own row, which an identical
paralog's would otherwise tie with.

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
