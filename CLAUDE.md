# jbrowse-plugin-msaview

An ES module plugin loaded into a JBrowse 5 host at runtime, code-split so a
config naming it evaluates the registration and nothing else. Almost everything
that has broken here has broken at that seam, in published bundles, after the
fact.

## v4 hosts load the frozen 3.10.0 UMD

3.10.0 was the last UMD build. Later releases are ESM-only for JBrowse 5: the
plugin store lists them under `>=5.0.0`, and the jb2hubs configs carry
`storePlugin: "MsaView"` beside a url pinned to the 3.10.0 UMD, so a v5 host
resolves this build and a v4 host never sees it. Until 5.0.0 is released, hosted
`main` and the nightly zip are the only hosts, and `pnpm host-compat` and the
e2e run there.

The externals are the installed `@jbrowse/core/ReExports/list`. A key the host
lacks throws at its first read, naming the key, so booting on `main` is the
check; `check-host-externals` and the host floor compared the build against its
own list once one host was left, and are gone.

## The weight stays out of the entry

The view registers its state model as a thunk and its component and launch
dialog behind `lazy()`, so react-msaview, msa-parsers and the dialog panels load
as chunks the first time someone uses them. Two consequences:

- `session.addView('MsaView')` throws until the model has loaded. Every launch
  goes through `launchMsaView`, which calls `session.launchView`.
- One value import at module scope from an eagerly loaded file puts the
  dependency back in the entry, and nothing in tsc, lint or the tests says so.
  `isMsaView` lives apart from `model.ts` for that reason, and
  `LaunchView-MsaView` imports `expandSpec` inside its handler. Read `meta.json`
  after touching an import on the registration path.

## `@jbrowse/core/util` is ReExports, and the barrel shrinks

The barrel is served by the host, so a name removed from it is `undefined`
inside bundles already published. That bit this plugin on 2026-08-01 —
`generateCodonTable(defaultCodonTable)` at module scope became
`Object.keys(undefined)` and PluginLoader error-paged the whole app — and
`useLocalStorage` broke the BLAST panel on nightly the same way. Before assuming
a barrel import works, check it against `main`.

## `@mui/material` is a hand-listed set, not all of MUI

The host's `JBrowseExports["@mui/material"]` is ~112 named components in
`@jbrowse/core/esm/ReExports/MuiReExports.js`, not the whole package. A name
missing from it is `undefined` in the bundle, and rendering `undefined` as a
component throws React error #130, which takes the whole dialog down.

`StepContent` is the one that bit: `Stepper`, `Step` and `StepLabel` are all on
the list and `StepContent` is not, so a stepper built the obvious way
typechecks, builds, passes `host-compat`, and error-pages the launch dialog on
every host. Nothing else catches it -- tsc resolves against the installed
`@mui/material` where the export is real, and the probe loads the bundle without
opening a panel, so an import that only evaluates on render stays invisible.

Dependencies hit it too. react-msaview 8.3.0 called `createFilterOptions` at
module scope, so the bundle threw while evaluating and error-paged the whole
app, not just a dialog. So `pnpm check-mui-imports` reads the build's
`meta.json` and diffs the named `@mui/material` imports of **every bundled
module** against that list, and runs on push and from `preversion`. When a
component is genuinely missing from the map, the deep path
(`@mui/material/StepContent`) is not in ReExports and so gets bundled -- at the
cost of shipping that component's MUI internals.

## A dep bump is a host-compatibility decision for mobx and typescript

`mobx`, `mobx-react` and `@jbrowse/mobx-state-tree` are in ReExports, so none of
them ships in the bundle -- each is a one-line shim handing off to the host's
`JBrowseExports[...]`, and the browser gets the host's copy whatever we declare.
That makes them look free to bump. They are not: the declared version is the API
surface tsc checks the source against, standing in for a host we cannot see, so
declaring a major the host does not serve turns tsc from a host-compatibility
check into a rubber stamp. Track what `@jbrowse/core` declares, not npm latest.

The local symptom is louder than the real risk and easy to mistake for a test
problem. A 2026-08 update to mst 6 / mobx 7 forked the package in two, because
`@jbrowse/core` keeps its own copy: 9 `[$type]` type errors, and
`multiple, different versions of MobX active` under vitest. None of that could
reach a browser -- but the fix is the pin, not a dedupe override, because an
override would silence the symptom and keep the rubber stamp.

On 2026-09-13 we took the other exit and moved the core devDep to
`5.0.0-beta.8`, which declares mobx 7 / mst 6 itself.

**typescript stays on 6.x** for an unrelated reason with the same shape.
TypeScript 7's package entry is a stub -- `require('typescript')` yields
`{version, versionMajorMinor}` and nothing else -- so anything reading the
compiler API through the ambient install breaks at once. jbrowse-components hit
that across six packages (see its `scripts/check-typescript-pin.ts`).

Here exactly one thing still reads it: typescript-eslint, which backs the
`lint:eslint` fallback and refuses to load against TS 7. `oxlint --type-aware`
is not affected -- measured 2026-08-25, oxlint-tsgolint carries its own compiler
and caught a planted `no-unnecessary-type-assertion` under both 6.0.3 and 7.0.2.
So the pin is the price of keeping the eslint fallback, and dropping that
fallback is the one-step way to free typescript. Decide it deliberately rather
than discovering it during a bump.

`pnpm check-host-dep-pins` enforces both, and runs in CI and from `preversion`.
It resolves each package from the plugin and from `@jbrowse/core` and compares
the directories on disk, so it catches a second copy however it arrives; the
typescript half reads typescript-eslint's own peer range and so lifts itself
once a release supports the newer compiler.

## oxlint is the linter, and `test/` needs its own tsconfig to be type-checked

`pnpm lint` is `oxlint --type-aware`; `pnpm format` and `pnpm check-format` are
oxfmt, which handles md/json/yaml here as well as ts/tsx, so prettier is gone.
`pnpm lint:eslint` keeps the old eslint config as a fallback -- it is what pins
typescript, per the section above.

**oxlint lints `test/` and `scripts/`; eslint only ever linted `src/`.** Turning
it on found a dead import and an unused mock that had sat in `test/` for as long
as those files existed. Expect the same the next time coverage widens.

**`tsconfig.json` has `"include": ["src"]`, so type-aware rules read `test/`
under default compiler options unless `test/tsconfig.json` extends the root
one.** Without it the repo's `noUncheckedIndexedAccess` does not apply, every
`arr[0]` looks non-nullable, and oxlint reports 28 bogus
`no-unnecessary-type-assertion` errors telling you to delete `!` that is load
bearing. The findings look exactly like real ones. If a type-aware rule suddenly
lights up a directory, check that directory is in a tsconfig before believing
it.

**`typescript/no-unnecessary-condition` is off for `test/`** because the types
there describe the happy path and the tests exist to survive its absence. Two
concrete cases: `let browser: Browser` is a lie until `beforeAll` succeeds, so
`await browser?.close()` is what keeps a setup failure from being buried under
`Cannot read properties of undefined (reading 'close')`; and the host feature
detects deliberately probe for members the types claim are always there. The
rule is right about the types and wrong about the code.

## BLAST runs on EBI, not NCBI, and that is not a preference

`blast.ncbi.nlm.nih.gov/Blast.cgi` returns no `Access-Control-Allow-Origin` to
third-party origins — it emits one only for `https://www.ncbi.nlm.nih.gov` — so
a browser cannot read it at all. That broke every host at once (#58, 2026-08)
and no plugin version fixes it. Searches now go to EBI's Job Dispatcher, which
serves `ACAO: *` and already ran the MSA step.

**There is no NCBI query path left at all** — `utils/ncbiBlast.ts`, the RID
panel, and the configurable base url were all deleted in 2.9.0. A proxy would
work, but shipping a service option that only functions for people who have
stood up server-side infrastructure is worse than not offering it, and a central
proxy is ruled out because NCBI throttles per source IP. Reaching `nr` now means
the **Manual** panel, which links out to NCBI's own site and never fetches
anything.

The reasoning and the evidence are in `docs/blast.md`. Read it before touching
`utils/ebiBlast.ts` or reaching for NCBI again.

**phmmer is a second search program, and its query row is derived rather than
aligned.** blastp stays the default; phmmer earns its place by aligning as it
searches, so its output is the MSA and no realignment can mis-pair one hit's
domain against another's. The catch is that phmmer leaves the query out of that
alignment unless the query is itself in the target database. `buildQueryRow`
recovers it from `#=GC RF`, which marks one column per query residue, and
**throws when the match columns do not account for the query exactly** — a query
row off by one residue would silently mis-map every column to the genome, which
is worse than no result. Do not soften that into a best effort. The measured
comparison of the two pipelines, including where phmmer is worse, is in
`docs/blast.md`.

**Job Dispatcher is the part of EBI that is reachable, not EBI generally.** The
HMMER web server at `www.ebi.ac.uk/Tools/hmmer` — a separate service from the
`hmmer3_phmmer` Job Dispatcher tool `utils/phmmer.ts` uses — serves its
`/Tools/hmmer/api/v1/` json only to `https://www.ebi.ac.uk`, with `Vary: Origin`
and a preflight that returns 200 carrying no CORS headers at all. That is the
Blast.cgi failure exactly, at a different institute. Same host, same institute,
neighbouring url: still check.

## Other things worth knowing

- **NCBI CDD domain annotations are fetched in-browser**, and the CORS
  constraint is what rules out Batch CD-Search. NCBI's per-service CORS policies
  differ: eutils sends `ACAO: *`, `api.ncbi.nlm.nih.gov/datasets` echoes the
  origin, and Blast.cgi now sends nothing. Never assume one from another.
- **A eutils throttle looks exactly like a CORS failure.** The limit is 3
  requests a second without an API key, and a throttled response comes back
  without `Access-Control-Allow-Origin`, so the browser reports "blocked by CORS
  policy: No 'Access-Control-Allow-Origin' header is present" for an endpoint
  that sends `ACAO: *` all day. Four concurrent calls on one dialog open was
  enough (2026-08-17, the Orthologs species field). Before believing a eutils
  CORS error, count the requests in the window and probe the same url alone.
  Keep concurrent eutils calls on any one screen under the limit.
- **MafViewer and GWAS are vendored into core**, so newer hosts skip those
  config entries and the external repos no longer need maintaining.
- **Browser console and autorun logs go missing in the puppeteer tests** unless
  the page is reloaded — that is the fix, not a logging bug.
