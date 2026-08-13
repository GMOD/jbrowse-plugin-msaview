# BLAST in jbrowse-plugin-msaview

The BLAST tab submits searches to **EBI**, and the reason is not preference.
There is no option to query NCBI directly, because there is no longer a way to
do it from a browser at all.

## NCBI's Blast.cgi is no longer readable from a browser

`https://blast.ncbi.nlm.nih.gov/Blast.cgi` returns no
`Access-Control-Allow-Origin` header to third-party origins. It sends
`Vary: Origin` on every response and emits an ACAO header for exactly one
origin, NCBI's own:

```
Origin: https://www.ncbi.nlm.nih.gov  → access-control-allow-origin: https://www.ncbi.nlm.nih.gov
Origin: https://jbrowse.org           → (none)
Origin: http://localhost:3000         → (none)
```

Both the `CMD=Put` submission and the `CMD=Get` status polls are affected. The
browser discards the response before any plugin code sees it, so the whole
search surfaces as a bare `TypeError: Failed to fetch` — which is what
[#58](https://github.com/GMOD/jbrowse-plugin-msaview/issues/58) reported. No
plugin version fixes it; it broke every host at once, jbrowse.org included.

Server-side access is unaffected: a request with no `Origin` header still
returns an RID, which is why scripts and Biopython never noticed.

There was no announcement. As of 2026-08-11 nothing appears in the
blast-announce archive (which stops at Nov 2024), the 2026 BLAST News page, NCBI
Insights, or the URL API docs — which never documented CORS support in the first
place. The URL API reads as script-facing throughout: poll no more than once a
minute, pass `tool` and `email`, run large batches overnight.

## Why EBI rather than a proxy we host

EBI's Job Dispatcher serves `Access-Control-Allow-Origin: *`, this plugin
already used it for the MSA step, and `ncbiblast` speaks the same
`run`/`status`/`result` protocol — so `utils/ebiJobDispatcher.ts` carries both.

A central proxy was the alternative and was rejected. NCBI throttles _per source
IP_: their own docs note that BLAST "limits the amount of compute resources that
can be used when running BLAST from a single IP address," on top of moving
anyone past 100 searches/24h to a slower queue. A proxy we host collapses every
msaview user in the world onto one IP, which is precisely the shape that
throttling targets — and the failure mode is not a clean error but the feature
quietly getting slower for everyone.

Running BLAST itself in a Lambda is not an option either: `nr` is far past
Lambda's 10GB storage ceiling. NCBI's answer for that is
[ElasticBLAST](https://blast.ncbi.nlm.nih.gov/doc/elastic-blast/), which
provisions a cluster per search — minutes of setup and real money for something
a user triggers by clicking a gene.

A configurable base url briefly survived so that a self-hoster could point the
NCBI path at their own proxy. That came out too: it shipped a service option
that was broken for everyone who had not built server-side infrastructure, and a
setting whose only correct value is one almost nobody has is worse than no
setting. `utils/ncbiBlast.ts` and the RID panel went with it. Anyone who really
wants `nr` from their own proxy is forking a file, not flipping a switch — and
the manual route below covers the occasional case without any of that.

## phmmer, and why its alignment is used as it comes

The automatic panel offers a second search program, `hmmer3_phmmer`, suggested in
[#58](https://github.com/GMOD/jbrowse-plugin-msaview/issues/58#issuecomment-5283718891).
It is another Job Dispatcher service, so it speaks the same run/status/result
protocol through `utils/ebiJobDispatcher.ts` and sends the same
`Access-Control-Allow-Origin: *`.

**Not to be confused with the HMMER web server** at `www.ebi.ac.uk/Tools/hmmer`,
which is a different service and is not usable from a browser. It was rebuilt as
a React SPA with a JSON api at `/Tools/hmmer/api/v1/` — the old
`POST /Tools/hmmer/search/phmmer` now answers `405` — and that api repeats
Blast.cgi's pattern exactly: `Vary: Origin`, and an ACAO header for
`https://www.ebi.ac.uk` and nobody else. The `OPTIONS` preflight returns 200 with
no CORS headers at all. Same failure as NCBI, at a different institute.

The phmmer path differs from the BLAST path in more than the program:

- **The search's own alignment is the MSA.** phmmer aligns every hit to a
  profile built from the query, so there is no realignment step. The BLAST path
  cannot do this — BLAST's alignments are pairwise, one hit at a time — so it
  strips them off and hands the bare subsequences to clustalo, which for a
  multi-domain protein can pair one hit's domain 1 against another's domain 2.
- **The query row is derived, not aligned.** phmmer leaves the query out of its
  own output unless the query is itself in the target database. It is exactly
  recoverable anyway: the profile has one match state per query residue, `#=GC RF`
  marks those columns, so the query is placed by walking `RF`. `parsePhmmerAlignment`
  throws rather than emitting a row it cannot place — a query row off by one
  residue would silently mis-map every column to the genome, which is worse than
  no result. The test checks the derivation against the query's own row in a
  swissprot search, where phmmer emits one to compare against.
- **The tree is built from the alignment**, by `simple_phylogeny` (clustalw2
  neighbour-joining, Kimura-corrected). What the BLAST path shows is clustalo's
  *guide* tree, which exists to order a progressive alignment and is not a
  phylogeny.
- **One row per matched region.** A target matching the query in several places
  gets a row each — four for lamprey albumin against human albumin — so row names
  carry the envelope to keep them distinct.
- Insert columns come back lowercase with `.` for gaps and are uppercased,
  because the MSA renderer looks colors up by the literal letter.

Databases are `swissprot`, `uniprotkb` and `uniprotrefprot`. phmmer also offers
PDB, AlphaFold, Ensembl Genomes, MEROPS and ChEMBL, but targets outside UniProt
carry no `OS=`/`OX=` in their description, so those rows would lose species and
common name.

Cache keys for phmmer results are prefixed; blastp keys are byte-identical to
what they always were, so results cached before phmmer existed still resolve.

## Trade-offs of the EBI backend

- Databases are the UniProtKB family, not NCBI `nr`. The default is
  `uniprotkb_swissprot`: curated, so it returns roughly one good sequence per
  species instead of the many near-identical entries that make a TrEMBL
  alignment hard to read.
- `blastp` only — EBI exposes no `quick-blastp` equivalent. In practice this
  costs nothing, since a swissprot search finishes in well under a minute.
- Taxon ids come from `hit_uni_ox` and are absent on hits from non-UniProt
  databases, so those rows fall back to `hit_os` for a species name and get no
  common name.

## Set a contact email if your site sends volume

EBI wants a contact address on every submission so they can reach whoever is
generating the load. The plugin ships with the maintainer's, which means every
msaview job in the world is attributed to one person — fine at demo volume, not
fine for a busy instance.

The BLAST settings dialog (gear icon) writes one to `localStorage` under
`msa-ebiContactEmail`, and it covers the MSA jobs as well as BLAST, since both
go through `utils/ebiJobDispatcher.ts`. A blank value falls back to the default
rather than submitting an empty `email`, which EBI rejects.

## Searching NCBI's nr: the manual route

The **Manual** option on the BLAST tab builds a link to NCBI's own search page
with the protein sequence filled in. The user runs BLAST there, clicks "Multiple
Alignment" for COBALT, and pastes the resulting `.aln` (and optionally the `.nh`
tree) back into JBrowse.

That path is unaffected by any of this, because the plugin never fetches
anything — it hands the user a url and the browser navigates to it.
