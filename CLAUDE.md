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
