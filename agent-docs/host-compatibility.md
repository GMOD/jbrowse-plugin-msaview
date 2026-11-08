# Host compatibility

jbrowse-plugin-msaview is an ES module plugin loaded into a JBrowse 5 host at
runtime, code-split so a config naming it evaluates the registration and nothing
else. Almost everything that has broken here broke at that seam, in published
bundles, after the fact.

## Which hosts load which build

3.10.0 was the last UMD build. Later releases are ESM-only for JBrowse 5: the
plugin store lists them under `>=5.0.0`, and the jb2hubs configs carry
`storePlugin: "MsaView"` beside a url pinned to the 3.10.0 UMD, so a v5 host
resolves this build and a v4 host never sees it. Until 5.0.0 is released, hosted
`main` and the nightly zip are the only hosts, and `pnpm host-compat` and the
e2e run there.

## Host imports

Host imports go through core's `hostShim` (`scripts/buildOptions.mjs`), which
binds each re-exported specifier to `JBrowseExports` and fails the build on a
name the installed core does not serve. A host lacking a name at runtime gets a
function that throws naming it. `pnpm check-host-floor` builds against what the
`FLOOR` in `scripts/check-host-floor.mjs` serves, the oldest host supported, and
runs in CI and from `preversion`; raising `FLOOR` drops every host below it.

What the shim exists to catch:

- `@jbrowse/core/util` is served by the host, and its barrel shrinks. On
  2026-08-01 `generateCodonTable(defaultCodonTable)` at module scope became
  `Object.keys(undefined)` and PluginLoader error-paged the whole app, and
  `useLocalStorage` broke the BLAST panel on nightly the same way.
- `@mui/material` is a hand-listed set of ~112 components
  (`@jbrowse/core/esm/ReExports/MuiReExports.js`), not the package.
  `StepContent` is missing while `Stepper`, `Step` and `StepLabel` are there, so
  a stepper built the obvious way error-paged the launch dialog with React error
  #130. react-msaview 8.3.0 called `createFilterOptions` at module scope and
  error-paged the whole app. When a component is genuinely missing from the map,
  its deep path (`@mui/material/StepContent`) is not in ReExports and so gets
  bundled, at the cost of shipping that component's MUI internals.

## Keeping the entry small

The view registers its state model as a thunk and its component and launch
dialog behind `lazy()`, so react-msaview, msa-parsers and the dialog panels load
as chunks the first time someone uses them. `session.addView('MsaView')`
therefore throws until the model has loaded, and every launch goes through
`launchMsaView`, which calls `session.launchView`. `isMsaView` lives apart from
`model.ts`, and `LaunchView-MsaView` imports `expandSpec` inside its handler, to
keep their dependencies out of the entry.

## Dependency pins

`mobx`, `mobx-react` and `@jbrowse/mobx-state-tree` are in ReExports, so none of
them ships in the bundle and the browser gets the host's copy whatever we
declare. The declared version is still the API surface tsc checks the source
against, standing in for a host we cannot see, so the pin tracks what
`@jbrowse/core` declares, not npm latest. A 2026-08 update to mst 6 / mobx 7
forked the package in two locally (9 `[$type]` type errors, and
`multiple, different versions of MobX active` under vitest); the fix was the
pin, not a dedupe override, which would silence the symptom. On 2026-09-13 the
core devDep moved to `5.0.0-beta.8`, which declares mobx 7 / mst 6 itself.

typescript stays on 6.x because typescript-eslint, which backs `lint:eslint`,
refuses to load against TS 7, whose package entry is a stub with no compiler
API. `oxlint --type-aware` carries its own compiler and is unaffected (measured
2026-08-25 under both 6.0.3 and 7.0.2), so dropping the eslint fallback is the
one-step way to free typescript.

`pnpm check-host-dep-pins` enforces both pins (CI and `preversion`). It resolves
each package from the plugin and from `@jbrowse/core` and compares the
directories on disk; the typescript half reads typescript-eslint's peer range
and lifts itself once a release supports the newer compiler.

## Lint

`pnpm lint` is `oxlint --type-aware`; `pnpm format` and `pnpm check-format` are
oxfmt, which handles md/json/yaml as well as ts/tsx. `pnpm lint:eslint` keeps
the eslint config for display-kit's conformance rules
(`@jbrowse/display-kit/conformance/lintRules`: every `.tsx` component an
`observer`, every `rpcManager.call` passing `signal` and `statusCallback`),
which are `no-restricted-syntax` selectors oxlint cannot run, so it runs in CI
and from `preversion` too.

`tsconfig.json` includes only `src`, so type-aware rules read a directory
outside every tsconfig under default compiler options. Before
`test/tsconfig.json` existed, the repo's `noUncheckedIndexedAccess` did not
apply there and oxlint reported 28 bogus `no-unnecessary-type-assertion` errors
asking to delete load-bearing `!`. When a type-aware rule suddenly lights up a
directory, check that the directory is in a tsconfig.

`typescript/no-unnecessary-condition` is off for `test/` because the types there
describe the happy path and the tests exist to survive its absence:
`let browser: Browser` is a lie until `beforeAll` succeeds, so
`await browser?.close()` keeps a setup failure from being buried, and the host
feature detects deliberately probe for members the types claim are always there.
