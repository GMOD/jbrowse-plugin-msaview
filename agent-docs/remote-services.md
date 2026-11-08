# Remote services and CORS

Every fetch runs in the reader's browser, so a service is usable only if it
sends `Access-Control-Allow-Origin` to third-party origins.

- BLAST runs on EBI's Job Dispatcher, not NCBI.
  `blast.ncbi.nlm.nih.gov/Blast.cgi` emits ACAO only for
  `https://www.ncbi.nlm.nih.gov`, which broke every host at once (#58, 2026-08).
  The NCBI query path, the RID panel and the configurable base url were deleted
  in 2.9.0. A proxy would work only for people who stand one up, and a central
  proxy is ruled out because NCBI throttles per source IP. Reaching `nr` means
  the Manual panel, which links out to NCBI. The reasoning, the evidence and the
  blastp-versus-phmmer comparison are in `docs/blast.md`.
- The HMMER web server at `www.ebi.ac.uk/Tools/hmmer`, a separate service from
  the `hmmer3_phmmer` Job Dispatcher tool `utils/phmmer.ts` uses, serves its
  `/Tools/hmmer/api/v1/` json only to `https://www.ebi.ac.uk`, with
  `Vary: Origin` and a preflight that returns 200 carrying no CORS headers. Same
  host, neighbouring url: still check.
- NCBI's per-service policies differ: eutils sends `ACAO: *`,
  `api.ncbi.nlm.nih.gov/datasets` echoes the origin, and Blast.cgi sends
  nothing. CDD domain annotations are fetched in-browser, and the CORS
  constraint is what rules out Batch CD-Search.
- eutils allows 3 requests a second without an API key, and a throttled response
  comes back without ACAO, so the browser reports a CORS failure for an endpoint
  that sends `ACAO: *` all day. Four concurrent calls on one dialog open was
  enough (2026-08-17, the Orthologs species field). `utils/eutils.ts` spaces
  every request it sends.
