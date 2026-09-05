# BLAST in jbrowse-plugin-msaview

The BLAST tab submits searches to **EBI**, and the reason is not preference.
There is no option to query NCBI directly, because there is no longer a way to
do it from a browser at all.

## What the searches are, in one page

A **similarity search** takes one protein and scans a database for sequences
that score well against it. The score is a sum over aligned residue pairs from a
substitution matrix (BLOSUM62: identical residues score high, chemically similar
ones a little, dissimilar ones negative) minus gap penalties. The **E-value** on
a hit is how many hits that good the search expected to find by chance in a
database this size, so 1e-50 is unarguable and 0.5 is noise.

- **blastp** finds short exact-ish seed matches, extends them into local
  alignments and reports each hit paired with the query on its own. The hits do
  not know about each other, so the plugin strips those pairings off and aligns
  the hits together afterwards.
- **phmmer** builds a profile from the query, one state per residue, and scores
  every database sequence against the profile. Because every hit is placed
  against the same profile, the hits come back already in shared columns: the
  search's output is the alignment. It is more sensitive than blastp for remote
  homologs and needs no aligner afterwards.
- A **UniRef cluster** is not a search. UniProt has already grouped every
  UniProtKB sequence by identity, so the query's cluster is looked up rather
  than computed, in a second or two. It reaches everything within 50% (or 90%)
  identity and nothing beyond that.

Which database decides what the rows are. `swissprot` is the curated set, about
one well-annotated entry per protein per species; `uniprotkb` is everything,
mostly unreviewed near-duplicates; `uniprotrefprot` is one proteome per species;
and phmmer's `rp15`..`rp75` are the reference proteomes thinned so no two are
more than 15%..75% similar, which spreads a hit list across the tree of life
instead of piling it on mammals.

The cost is the queue, not the search. EBI's Job Dispatcher runs each submission
as a cluster job, and the wait is whatever the cluster is doing. Measured on
human p53 on 2026-09-05: blastp against swissprot finished in 36s, while three
phmmer jobs (swissprot, rp15, uniprotrefprot) took 12 to 15 minutes each, and
two of them reported a SLURM 502 for ten minutes of that before finishing.
Nothing about the sequence or the database explains the difference; the queue
does. That is why the plugin now aligns in the browser by default where it can
(`msaAlgorithm: "browser"`), builds trees in the browser, and offers the UniRef
lookup: a launch that needs no job cannot be queued.

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

The automatic panel offers a second search program, `hmmer3_phmmer`, suggested
in
[#58](https://github.com/GMOD/jbrowse-plugin-msaview/issues/58#issuecomment-5283718891).
It is another Job Dispatcher service, so it speaks the same run/status/result
protocol through `utils/ebiJobDispatcher.ts` and sends the same
`Access-Control-Allow-Origin: *`.

**Not to be confused with the HMMER web server** at `www.ebi.ac.uk/Tools/hmmer`,
which is a different service and is not usable from a browser. It was rebuilt as
a React SPA with a JSON api at `/Tools/hmmer/api/v1/` — the old
`POST /Tools/hmmer/search/phmmer` now answers `405` — and that api repeats
Blast.cgi's pattern exactly: `Vary: Origin`, and an ACAO header for
`https://www.ebi.ac.uk` and nobody else. The `OPTIONS` preflight returns 200
with no CORS headers at all. Same failure as NCBI, at a different institute.

The phmmer path differs from the BLAST path in more than the program:

- **The search's own alignment is the MSA.** phmmer aligns every hit to a
  profile built from the query, so there is no realignment step. The BLAST path
  cannot do this — BLAST's alignments are pairwise, one hit at a time — so it
  strips them off (`strip()`) and hands the bare subsequences to clustalo to
  align again from scratch. How much that costs is measured below: less than you
  would guess on average, a lot on individual hits.
- **The query row is derived, not aligned.** phmmer leaves the query out of its
  own output unless the query is itself in the target database. It is exactly
  recoverable anyway: the profile has one match state per query residue,
  `#=GC RF` marks those columns, so the query is placed by walking `RF`.
  `parsePhmmerAlignment` throws rather than emitting a row it cannot place — a
  query row off by one residue would silently mis-map every column to the
  genome, which is worse than no result. The test checks the derivation against
  the query's own row in a swissprot search, where phmmer emits one to compare
  against.
- **The tree is built from the alignment**, in the browser, by react-msaview's
  neighbour joining over BLOSUM62 distances. It used to be a second EBI job
  (`simple_phylogeny`, clustalw2's Kimura-corrected neighbour joining), which
  doubled the queue wait for no better tree. What the BLAST path shows when an
  EBI aligner runs is that aligner's _guide_ tree, which exists to order a
  progressive alignment and is not a phylogeny; with the in-browser aligner it
  is the same neighbour-joining tree.
- **One row per matched region.** A target matching the query in several places
  gets a row each — four for lamprey albumin against human albumin — so row
  names carry the envelope to keep them distinct.
- Insert columns come back lowercase with `.` for gaps and are uppercased,
  because the MSA renderer looks colors up by the literal letter.

Databases are `swissprot`, `uniprotkb`, `uniprotrefprot` and the representative
proteomes `rp15`, `rp35`, `rp55` and `rp75`. The rp databases write their
descriptions as caret-pipe fields
(`P53_HUMAN^|^...^|^Homo sapiens^|^9606^|^...`) rather than `OS=`/`OX=`, and
name rows by bare accession, so the parser reads both grammars. phmmer also
offers PDB, AlphaFold, Ensembl Genomes, MEROPS and ChEMBL, but targets outside
UniProt carry no species in their description at all, so those rows would lose
species and common name.

Cache keys for phmmer results are prefixed; blastp keys are byte-identical to
what they always were, so results cached before phmmer existed still resolve.

## What the two pipelines actually produce

Measured on human albumin against swissprot, both run for real. BLAST states its
own residue-by-residue pairing of query to target in every HSP, which is an
independent second opinion to score each finished MSA against: of the pairs
BLAST asserted, how many does the MSA still place in the same column?

|                            | blastp + clustalo   | phmmer              |
| -------------------------- | ------------------- | ------------------- |
| BLAST's aligned pairs kept | 25052/26315 (95.2%) | 24572/25021 (98.2%) |
| hits keeping under half    | 4 of 60             | 0 of 46             |
| distinct targets returned  | 60                  | ~45                 |
| query row gaps             | 103 of 712 columns  | 96 of 705           |

So **on the average hit the two are close**, and the realignment step is not the
disaster it might sound like — clustalo puts 95% of it back. The difference is
in the tail, and it is worth understanding rather than rounding off:

- `P83517`, lungfish albumin, is in swissprot as two disjoint fragments.
  clustalo keeps **0%** of BLAST's pairing for it; phmmer keeps 100%. This is
  the multi-region case, and it is the one place the realignment genuinely falls
  over.
- The most divergent paralogs are where profile alignment earns its keep:
  vitamin D-binding protein rows gain 5 to 14 points (`Q3MHN5` 0.84 → 0.98,
  `P02774` 0.88 → 0.96).
- Three of clustalo's four bad hits are targets **phmmer never returned**, so
  phmmer wins those by omission rather than by aligning them better. phmmer's
  inclusion threshold is stricter: 60 distinct targets from BLAST against about
  45 from phmmer. Sensitivity is a real trade in the other direction.
- phmmer scores _worse_ on `Q91274` (0.91 → 0.75) and `P85295` (0.93 → 0.78),
  both targets it split into several rows. BLAST's single HSP spans regions
  phmmer reports separately, so no one phmmer row can cover all of it — an
  artifact of the comparison rather than a real loss.

**The trees come out the same.** Scoring both for whether each known paralog
family forms a clade: afamin and vitamin D-binding protein do in both, albumin
and alpha-fetoprotein in neither. So `simple_phylogeny` on the phmmer alignment
is not measurably better here than clustalo's guide tree — the argument for it
is that a guide tree is not a phylogeny and should not be drawn as one, not that
this gene came out differently. What both trees do get right is putting the
query next to human albumin, its own swissprot entry.

## Trade-offs of the EBI backend

- Databases are the UniProtKB family, not NCBI `nr`. The default is
  `uniprotkb_swissprot`: curated, so it returns roughly one good sequence per
  species instead of the many near-identical entries that make a TrEMBL
  alignment hard to read.

  EBI validates the database name and answers a submission naming one it does
  not have with a 400, at the point the user presses go. `pnpm check-ebi-params`
  reads `blastDatabaseOptions` and `msaAlgorithms` and asks EBI whether it still
  accepts each one; it runs on push and daily, because the list can break from
  either side -- a value we invent, or one EBI retires while this repo sits
  still. 3.0.0 shipped `uniprotkb_reference_proteomes`, which EBI has never had
  and which nothing in CI could see, since the string typechecks and the panel
  only fails at submit time.

- `blastp` only — EBI exposes no `quick-blastp` equivalent. The search itself is
  quick; what a user waits on is the queue (see the top of this page).
- Taxon ids come from `hit_uni_ox` and are absent on hits from non-UniProt
  databases, so those rows fall back to `hit_os` for a species name and get no
  common name.

## The manual route walks the whole round trip

Reaching NCBI's `nr` means running the search on NCBI's own site, because no
plugin version can query Blast.cgi from a browser. The panel used to hand over a
link, say "paste the results into JBrowse", and offer only a Close button --
leaving the user to find the Manual upload tab, re-pick the transcript they had
already chosen, and hand-type the name of the MSA row holding their gene.

That last step is the one that hurt. The MsaView ties alignment columns to
genome coordinates through that row name, and a wrong one fails silently: the
view opens, renders correctly, and simply never navigates or highlights. It
reads as a broken feature rather than a wrong field.

So the panel now carries all three steps, and `detectQueryRow` finds the row by
sequence instead of asking. The plugin already knows the protein it sent, so it
ungaps each row and compares. Both aligners rename the query on the way through
-- COBALT emits `Query_1`, EBI's carry the accession -- which is why the name is
no help and the residues are.

Detection only claims a match it can defend: an exact hit, a row that is the
query trimmed to the aligned region and still covering half of it, or a 90%+
identity. An alignment of homologs is full of rows in the 40-70% range, and
picking the best of those would wire the view to a paralog from another species
with total confidence. When nothing matches, the field becomes a dropdown of the
alignment's own row names -- still not a free text box to typo.

The Manual upload tab uses the same detection, which is what let its "you must
specify the row name" warning go away.

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
