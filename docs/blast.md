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
