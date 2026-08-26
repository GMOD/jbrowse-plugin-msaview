# jbrowse-plugin-msaview

A UMD plugin loaded into a JBrowse host at runtime. Almost everything that has
broken here has broken at that seam, in published bundles, after the fact.

## A `@jbrowse/core` import is only a host dependency if it is in ReExports

An import binds to the host's export surface **only** when its path appears in
`@jbrowse/core/ReExports/list`. A path absent from that list — say
`@jbrowse/core/util/convertCodingSequenceToPeptides` — is bundled into the UMD
by esbuild instead, so it runs identically on every host from v4.0.0 to `main`
and cannot break when the host's exports change.

The barrel `@jbrowse/core/util` **is** in ReExports, which is what makes it
dangerous: a name removed from it becomes `undefined` inside bundles that are
already published and in the wild. That bit this plugin on 2026-08-01 —
`generateCodonTable(defaultCodonTable)` at module scope became
`Object.keys(undefined)`, the UMD global was never assigned, and PluginLoader
error-paged the whole app. The same removal had already broken
jbrowse-plugin-protein3d.

**So: to reuse core logic, prefer a deep path that is not in ReExports over the
barrel.** Check with `l.includes(path)` against the ReExports list, and verify
what actually binds to the host by grepping the built bundle for
`JBrowseExports["..."]`. The constraint is the _installed_ `@jbrowse/core`
version, not the host's — the deep path has to exist in the released package you
build against.

**The barrel really does shrink.** As of 2026-08-01 it exported 194 names at
v4.3.0 and had lost 48 of them on `main` (barrel splits such as
`3c921d59e1 refactor(util): split index.ts into focused modules`). Four were
pure tidy-up losses and were restored in `b8c91bb110` — `useLocalStorage`,
`useDebounce`, `useWidthSetter`, `renderToStaticMarkup`. The other 44 had their
implementations deleted. `useLocalStorage` broke this plugin's NCBI BLAST panel
on nightly with `(0 , PR.useLocalStorage) is not a function`. Before assuming a
`@jbrowse/core/util` import works everywhere, check it against **both** v4.3.0
and `main`.

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

`pnpm check-mui-imports` diffs src/'s named `@mui/material` imports against that
list, and runs on push. When a component is genuinely missing from the map, the
deep path (`@mui/material/StepContent`) is not in ReExports and so gets bundled
-- at the cost of shipping that component's MUI internals, and the shape risk in
the root CLAUDE.md's SvgIcon note.

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

**oxlint lints `test/`, `scripts/` and `ucsc/`; eslint only ever linted
`src/`.** Turning it on found a dead import and an unused mock that had sat in
`test/` for as long as those files existed. Expect the same the next time
coverage widens.

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

## Don't drop the v3.7.0 leg from the integration matrix

It is the only check that has ever caught the legacy context-menu regression —
the class of failure where a plugin reads only `main`'s API shape and silently
renders no menu item on every host a user actually runs. Nothing else in CI is
sensitive to it.

**The corollary catches tests, not just source: every leg runs the WHOLE
suite.** `pnpm vitest run` executes against nightly, v4.3.0 and v3.7.0 in turn,
so a test that asserts a feature only `main` has fails on two legs out of three.
Workspaces are the live example — v4.3.0 and v3.7.0 have no tiling at all, and
`test/placement.test.ts` asserting two grid cells would have been asserting that
an old release grew a feature. A test over host-dependent behaviour has to
feature-detect exactly as the source does, then assert the documented
degradation on the hosts that lack it.

Detect on the session, never on `TEST_JBROWSE_VERSION`: the version tells you
what was downloaded, the session tells you what the plugin will actually find,
and only the second is the thing under test. Guard the _reads_ too —
`panelContainingView` does not exist on v4.3.0, so a helper reaching for it
throws there rather than returning nothing.

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
