# jbrowse-plugin-msaview

A UMD plugin loaded into a JBrowse host at runtime. Almost everything that has
broken here has broken at that seam, in published bundles, after the fact.

## A `@jbrowse/core` import is only a host dependency if it is in ReExports

An import binds to the host's export surface **only** when its path appears in
`@jbrowse/core/ReExports/list`. A path absent from that list — say
`@jbrowse/core/util/convertCodingSequenceToPeptides` — is bundled into the UMD by
esbuild instead, so it runs identically on every host from v4.0.0 to `main` and
cannot break when the host's exports change.

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
`JBrowseExports["..."]`. The constraint is the *installed* `@jbrowse/core`
version, not the host's — the deep path has to exist in the released package you
build against.

**The barrel really does shrink.** As of 2026-08-01 it exported 194 names at
v4.3.0 and had lost 48 of them on `main` (barrel splits such as `3c921d59e1
refactor(util): split index.ts into focused modules`). Four were pure tidy-up
losses and were restored in `b8c91bb110` — `useLocalStorage`, `useDebounce`,
`useWidthSetter`, `renderToStaticMarkup`. The other 44 had their implementations
deleted. `useLocalStorage` broke this plugin's NCBI BLAST panel on nightly with
`(0 , PR.useLocalStorage) is not a function`. Before assuming a
`@jbrowse/core/util` import works everywhere, check it against **both** v4.3.0
and `main`.

## Don't drop the v3.7.0 leg from the integration matrix

It is the only check that has ever caught the legacy context-menu regression —
the class of failure where a plugin reads only `main`'s API shape and silently
renders no menu item on every host a user actually runs. Nothing else in CI is
sensitive to it.

## Other things worth knowing

- **NCBI CDD domain annotations are fetched in-browser**, and the CORS
  constraint is what rules out Batch CD-Search.
- **MafViewer and GWAS are vendored into core**, so newer hosts skip those config
  entries and the external repos no longer need maintaining.
- **Browser console and autorun logs go missing in the puppeteer tests** unless
  the page is reloaded — that is the fix, not a logging bug.
