# BLAST in jbrowse-plugin-msaview

The "NCBI BLAST query" tab can run a search on one of two services. **EBI is the
default**, and the reason is not preference.

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

## Running against NCBI anyway, through your own proxy

Selecting **NCBI** in the service dropdown still works if the BLAST base url
(gear icon, stored in `localStorage` as `msa-blastRootUrl`) points at a proxy
you host. Every call is `${baseUrl}?…`, so the proxy needs to forward the query
string and POST bodies unchanged and add the CORS headers.

This is the right place for the traffic: it runs under your institution's IP and
your own query volume, which is how NCBI's per-IP accounting expects to see it.

A Lambda behind a Function URL is enough:

```js
const UPSTREAM = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi'

// Pin the upstream. A proxy that takes the target from the request is an open
// relay and will be found and used as one.
export const handler = async event => {
  const { rawQueryString, body, isBase64Encoded } = event
  const method = event.requestContext.http.method
  const origin = event.headers.origin ?? ''

  // Allowlist your own site rather than echoing whatever asks.
  const allowed = ['https://jbrowse.example.org']
  const cors = {
    'Access-Control-Allow-Origin': allowed.includes(origin)
      ? origin
      : allowed[0],
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors }
  }

  const res = await fetch(
    rawQueryString ? `${UPSTREAM}?${rawQueryString}` : UPSTREAM,
    {
      method,
      headers:
        method === 'POST'
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : undefined,
      body:
        method === 'POST'
          ? isBase64Encoded
            ? Buffer.from(body ?? '', 'base64').toString()
            : body
          : undefined,
    },
  )

  return {
    statusCode: res.status,
    headers: {
      ...cors,
      'Content-Type': res.headers.get('content-type') ?? 'text/html',
    },
    body: await res.text(),
  }
}
```

Two things to keep right:

- **Do not forward the browser's `Origin` header upstream.** NCBI has treated a
  foreign `Origin` on a POST as a CSRF signal since at least 2017 and answers
  `403`. Omitting it is what makes the proxied request look like the ordinary
  script request it is.
- **Do not run the poll loop inside the Lambda.** The browser polls every 20s
  and each poll should be its own short invocation; a Lambda that waits for a
  10-minute blastp is paying to sleep and will hit the 15-minute ceiling.
