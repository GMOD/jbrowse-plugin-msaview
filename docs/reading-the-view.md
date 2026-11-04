# Reading what a view resolved

A launch makes choices nobody wrote down: which search ran and under which job,
how many rows came back, whether the query row was found, whether the columns
reach the genome. The header and the warning chip show them to a reader; a
script or an agent reads the same things off the view model.

- **In:** an open MsaView, from `session.views` or `jb.view(viewId)`
- **Out:** plain JSON: where the alignment came from, its size, the query row,
  the genome connection, and what went wrong along the way

The example is read off three HBB proteins beside GENCODE's HBB-201 on hg38,
launched with `domainsOnGenome`, which the e2e leg
`a launch with domainsOnGenome adds the domain track once the domains load`
asserts.

## `view.report`

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
  `loading` never outlasts the work.
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

## Notices

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
`connectedViewId`, no view with that id, a genome view that failed to load, or
one with no feature track open. A genome view still loading its assembly or
opening the tracks its own launch names is waited for. The connection recovers
by itself when what was missing arrives: a genome view added after the MsaView,
or a gene track opened later.
