## [3.4.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.3.0...v3.4.0) (2026-08-26)

### Bug Fixes

- Show progress and errors for an ortholog launch, not just BLAST ([32471f8](https://github.com/GMOD/jbrowse-plugin-msaview/commit/32471f8bc2b94bbaaa2c1ac1c867e9fb23575a87))
- A query row the alignment does not have maps to nothing, not column 0 ([2e4d6df](https://github.com/GMOD/jbrowse-plugin-msaview/commit/2e4d6df5f3a6d4ec27f3026f57c2e849659ddc56))
- A cached phmmer result no longer lists its aligner as "(undefined)" ([e816bde](https://github.com/GMOD/jbrowse-plugin-msaview/commit/e816bdeec3ce86cab71a493a21fced6c78b919e4))
- Widen the database field so its value is readable ([59b8492](https://github.com/GMOD/jbrowse-plugin-msaview/commit/59b8492272f73fd51a7624f7569fefe854340129))

### Chores

- Guard the deps the host supplies, and the typescript eslint can load ([8484ad6](https://github.com/GMOD/jbrowse-plugin-msaview/commit/8484ad63c4b6d41108f75ba0b13002f19c241362))
- Replace eslint and prettier with oxlint and oxfmt ([e2de8bf](https://github.com/GMOD/jbrowse-plugin-msaview/commit/e2de8bfc38af19eeb2f79a4f0dd02f0996ba2ec1))
- Format the captured metadata fixture ([cb6e7dd](https://github.com/GMOD/jbrowse-plugin-msaview/commit/cb6e7dd3261a0053380d91883cd16c2fb88c4940))
- Check phmmer's databases and the tree tool against EBI too ([6fd6b86](https://github.com/GMOD/jbrowse-plugin-msaview/commit/6fd6b86d9f4f1fb5daef02ab3e57f1cc8dcdc8bc))
- Drop defaultSearchProgram, which nothing reads ([290e3e1](https://github.com/GMOD/jbrowse-plugin-msaview/commit/290e3e150d68642a789c4dc095a1cbe259f14496))

### Documentation

- Docs: the phmmer query row must throw, and a real change can hide under the ([736bc67](https://github.com/GMOD/jbrowse-plugin-msaview/commit/736bc674a57249c23086953330c83cfbb2d48974))

### Features

- Add phmmer as a search program, and use its alignment as-is ([c36882d](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c36882d935e55eed832f9a39d09ec3af82ef14e3))

### Performance Improvements

- Ask NCBI and EBI once for what they were asked twice for ([f15bdc7](https://github.com/GMOD/jbrowse-plugin-msaview/commit/f15bdc70a361000a5127b9bef67df58ca2a634b9))

### Refactoring

- Parse a pasted alignment once per keystroke, not twice ([4bde79a](https://github.com/GMOD/jbrowse-plugin-msaview/commit/4bde79a6d41f187436071547323adfa1ea6e5cc1))
- Let the program decide the database's type, not a cast ([54579d5](https://github.com/GMOD/jbrowse-plugin-msaview/commit/54579d5104694136ebbed038e74ce0662ea03672))

### Tests

- Check the pipeline end to end against EBI, and measure it ([3db0b5b](https://github.com/GMOD/jbrowse-plugin-msaview/commit/3db0b5b9918abd8f640ea465089376579f336fdf))
- Screenshot the rendered alignment and the launch dialog ([65088e4](https://github.com/GMOD/jbrowse-plugin-msaview/commit/65088e435239f6cf770e11b606818ed93434c3fd))
- Cover the row naming without needing the network ([7446339](https://github.com/GMOD/jbrowse-plugin-msaview/commit/7446339f737c3f2e2ca483fd0ca922894ac7a316))
- Recapture the references against the rebased panel ([eab3a34](https://github.com/GMOD/jbrowse-plugin-msaview/commit/eab3a349234ce10c8de8bbf63f1e5adba6b1c2ca))

## [3.3.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.2.0...v3.3.0) (2026-08-25)

### Documentation

- Every matrix leg runs the whole suite, so tests feature-detect too ([7d2bf39](https://github.com/GMOD/jbrowse-plugin-msaview/commit/7d2bf3966a84b3a3b5e8abf0a359ea075f9fb424))
- The source key, and what the CDD overlay does with UniProt accessions ([b735837](https://github.com/GMOD/jbrowse-plugin-msaview/commit/b735837faa5321ba916631e606a3ed8cad77cd6b))
- Two live ortholog sources is the ceiling, new coverage is build-time data ([3aabcd3](https://github.com/GMOD/jbrowse-plugin-msaview/commit/3aabcd36af22889b37bb0b1039ea20ac9ee9b3cb))

### Features

- PANTHER as a second source, for the species NCBI's sets leave out ([380b512](https://github.com/GMOD/jbrowse-plugin-msaview/commit/380b5127c303b282bf0f686929b98f6642b59ffd))

### Tests

- Refresh the launch-dialog references for the Source select ([c4c94ce](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c4c94ce700d9645c80e99a02ea7ff83a89e715ec))

## [3.2.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.1.0...v3.2.0) (2026-08-25)

### Bug Fixes

- Stop the placement checkbox squeezing the dialog's buttons ([fb00406](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fb0040641d37c4eaf5fd67310ce18de0e96dbb5b))

### Documentation

- The placement key, and the spec that puts an alignment beside its genome ([0658e24](https://github.com/GMOD/jbrowse-plugin-msaview/commit/0658e24e503709af312c71a6a78d14bd8cbcfc3e))

### Features

- Say where a launched MSA view goes, instead of always stacking it ([92fa38a](https://github.com/GMOD/jbrowse-plugin-msaview/commit/92fa38a3f7233fad2e3bd4f0061af2445286d707))

### Tests

- Prove the split on a real host, not just on a stub session ([91bedc6](https://github.com/GMOD/jbrowse-plugin-msaview/commit/91bedc63a81d1771d81ac83d43919e6620604d6c))
- Cover the placement checkbox, in the two places it can be covered ([a0637e7](https://github.com/GMOD/jbrowse-plugin-msaview/commit/a0637e7f41232b2fb099d64f638820cf6324346c))
- The placement spec test has to survive hosts that cannot tile ([67617ad](https://github.com/GMOD/jbrowse-plugin-msaview/commit/67617ad54cd4a19172fdc970defe1d63a546d8cb))

## [3.1.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.0.0...v3.1.0) (2026-08-19)

### Bug Fixes

- Swap the dead uniprotkb_reference_proteomes option for pan_proteomes ([42b624c](https://github.com/GMOD/jbrowse-plugin-msaview/commit/42b624c6336fea8bb8d62b989060ded3cd1a34ab))

### Chores

- Check the panel's databases and tools against EBI's own lists ([300f948](https://github.com/GMOD/jbrowse-plugin-msaview/commit/300f948afd194bef0c7b391bbd589fdd28c8fb5b))

### Features

- Mirror the clicked domain onto the alignment, not just the hover ([b8d0d3e](https://github.com/GMOD/jbrowse-plugin-msaview/commit/b8d0d3e39efdef221d54ca4a63cb73b8d89efd5c))
- Finish the manual BLAST round trip in the panel, and find the query row by sequence ([fb8f049](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fb8f049672f5fbc46a08da6ea16b0aff0e66e329))

### Refactoring

- Say why the click channel is skipped mid-hover, unpick sameColumns ([1ff441b](https://github.com/GMOD/jbrowse-plugin-msaview/commit/1ff441b28f8883bc53a850fc723f4e03491641e3))

### Tests

- Recapture the v4.3.0 references for the new row selector ([0e11523](https://github.com/GMOD/jbrowse-plugin-msaview/commit/0e1152371f33112fb1857fc32231f593835ecf6a))

## [3.0.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.10.2...v3.0.0) (2026-08-18)

### Features

- **BREAKING** React-msaview 6.0.0 (#60) ([c43a060](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c43a060503a95875bccd4c159b84b2809786fe6d))

## [2.10.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.10.1...v2.10.2) (2026-08-17)

### Bug Fixes

- Write the key separator as an escape, not a raw NUL byte ([cb705d6](https://github.com/GMOD/jbrowse-plugin-msaview/commit/cb705d631c05b75fdb2a0578ae07fd941c65b1c3))

### Chores

- Fail on the two things 2.10.1 shipped that nothing was watching ([632e654](https://github.com/GMOD/jbrowse-plugin-msaview/commit/632e654120bc5923e5e6c76465a0f79333c856d4))
- Generate the changelog with git-cliff, release from the tag ([bed4b8d](https://github.com/GMOD/jbrowse-plugin-msaview/commit/bed4b8d0ee5e6db36db63b72f687e1787476f095))

### Documentation

- Backfill every release, in git-cliff's heading shape ([cafe4a4](https://github.com/GMOD/jbrowse-plugin-msaview/commit/cafe4a42f3992adbb1e4613e26350619119bfaca))

### Tests

- Recapture the five dialog references after the throttle fix ([fc45237](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fc45237b7b0d2b608d6a4064334620516d1127b9))
- Recapture the v4.3.0 dialog references after the throttle fix ([5c011c1](https://github.com/GMOD/jbrowse-plugin-msaview/commit/5c011c1e3c58172626e950d653fea970da803777))
- Keep committed references only for the gated hosts ([763a0e3](https://github.com/GMOD/jbrowse-plugin-msaview/commit/763a0e3ebd65d24bba6cd4eb47bc806b835a4ee1))

## [2.10.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.10.0...v2.10.1) (2026-08-17)

- Take the query species from the assembly instead of assuming human
- Do one eutils lookup for the query species rather than four, which the
  throttled endpoint reported as a CORS failure
- Replace swr with a vendored useFetch
- Call the display's super contextMenuItems with a receiver, so Launch MSA view
  works on both host shapes
- react-msaview and msa-parsers 5.10.0

## [2.10.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.9.0...v2.10.0) (2026-08-17)

- Align every species NCBI has an ortholog for, rather than a fixed list of 23
- Name the query row for its species
- Keep polling an EBI job through a transient status-check failure
- Gate Launch MSA view on the clicked item, not the host's getter
- react-msaview and msa-parsers 5.7.3

## [2.9.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.8.2...v2.9.0) (2026-08-11)

- Run BLAST searches on EBI's Job Dispatcher. The direct NCBI query path is gone
  entirely: Blast.cgi sends no `Access-Control-Allow-Origin` to third-party
  origins, so no browser can read it. Reaching `nr` now means the Manual panel,
  which links out to NCBI
- Let a deployment set its own contact email for EBI
- Share the Job Dispatcher transport between the MSA and BLAST paths
- Say what a "Failed to fetch" actually means

## [2.8.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.8.1...v2.8.2) (2026-08-09)

- Build an ortholog alignment from a session spec, not only from the dialog

## [2.8.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.8.0...v2.8.1) (2026-08-09)

- react-msaview 5.7.2, for the gappyness slider's testid

## [2.8.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.7.4...v2.8.0) (2026-08-09)

- Ten more species in the orthologs dialog, in less vertical space

## [2.7.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.7.3...v2.7.4) (2026-08-06)

- Build the MSA from NCBI orthologs instead of a BLAST search
- react-msaview and msa-parsers 5.7.1

## [2.7.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.7.2...v2.7.3) (2026-08-06)

- Correct the genome<->MSA coordinate conversions in both directions
- Type the IndexedDB stores and scope the cache clear
- react-msaview 5.7.0

## [2.7.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.7.1...v2.7.2) (2026-08-01)

- Restore the pre-4.3 context menu path, and stop importing `useLocalStorage`,
  which `@jbrowse/core/util` no longer exports on nightly
- Stop translating through the host's codon table
- Refuse to tag a release when Integration is red on HEAD

## [2.7.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.7.0...v2.7.1) (2026-07-30)

- Boot on released JBrowse hosts again: bundle `@mui/material/SvgIcon` rather
  than resolving it from the host, whose exported shape varies by MUI major

## [2.7.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.8...v2.7.0) (2026-07-24)

- Adapt Launch MSA view to the canvas-based LinearBasicDisplay
- Notify instead of silently failing when an MSA feature can't load
- Drop the legacy contextMenuFeature fallback

## [2.6.8](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.7...v2.6.8) (2026-07-04)

- Simplify the MSA launch flow, and reconnect cached BLAST results to the genome

## [2.6.7](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.6...v2.6.7) (2026-07-04)

- Fix cache bugs, drop dead code, memoize IndexedDB connections

## [2.6.6](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.5...v2.6.6) (2026-07-02)

- Keep the MSA click-selection genome band visible while hovering the LGV

## [2.6.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.4...v2.6.5) (2026-06-28)

- react-msaview and msa-parsers 5.5.0

## [2.6.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.3...v2.6.4) (2026-06-27)

- Drop the legacy MSA-driven structure-highlight path

## [2.6.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.2...v2.6.3) (2026-06-27)

- Connect a genome-linked MSA to its 3D structure without requiring a UniProt id
- Narrow the launch extension point to sources resolved at launch time

## [2.6.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.1...v2.6.2) (2026-06-27)

- Simplify the launch extension point init

## [2.6.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.0...v2.6.1) (2026-06-27)

- Replace the tabix-by-locus MSA launch with a name-indexed bgzip read

## [2.6.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.5.2...v2.6.0) (2026-06-27)

- Launch an alignment from a locus-keyed tabix file (msaTabixLocation + msaId)

## [2.5.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.5.1...v2.5.2) (2026-06-27)

- Fix observeProteinHighlights wiping the declarative highlightColumns seed

## [2.5.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.5.0...v2.5.1) (2026-06-26)

- Overlay NCBI CDD protein domain and site annotations on the alignment
- Support declarative highlightColumns
- react-msaview 5.4.1

## [2.5.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.5...v2.5.0) (2026-05-29)

- Fix the BLAST/MSA polling delay and CDS matching, and wire genome hover to the
  MSA highlight

## [2.4.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.4...v2.4.5) (2026-05-28)

- Fix the isoform combobox lookup for MUI 7's div-based InputLabel
- Simplify the highlight sync derived state
- Stop shipping source maps

## [2.4.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.3...v2.4.4) (2026-05-21)

- Dependency bumps

## [2.4.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.2...v2.4.3) (2026-05-21)

- Share scaffolding between the MSA launch panels

## [2.4.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.1...v2.4.2) (2026-05-21)

- Re-release

## [2.4.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.0...v2.4.1) (2026-05-21)

- Re-release

## [2.4.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.8...v2.4.0) (2026-05-14)

- Suppress the codon highlight in the LGV during genome hover
- Tighten BLAST types and dialog SWR keys, fixing silent bugs
- Batch taxonomy cache reads and trim dead code
- Remove the Ensembl gene tree panel
- Restore the version-based release pipeline

## [2.3.8](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.7...v2.3.8) (2026-05-06)

- Re-release

## [2.3.7](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.6...v2.3.7) (2026-05-06)

- Move the release steps into `scripts/release.mjs`

## [2.3.6](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.5...v2.3.6) (2026-05-06)

- Use ErrorMessage from `@jbrowse/core/ui` in ConnectStructureDialog
- Fix a handleClose bug and convert inline styles to makeStyles
- Type safety and code quality cleanups

## [2.3.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.4...v2.3.5) (2026-05-02)

- Fix the publish workflow

## [2.3.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.3...v2.3.4) (2026-05-02)

- Prevent stale async operations from overwriting state in data-fetching effects
- Migrate CI and the repo to pnpm, and ESLint to flat config with import-x
- Bump react-msaview

## [2.3.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.2...v2.3.3) (2026-04-16)

- Generate `src/version.ts` on release

## [2.3.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.1...v2.3.2) (2026-04-16)

- Publish from postversion

## [2.3.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.0...v2.3.1) (2026-04-16)

- Publish with --provenance

## [2.3.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.11...v2.3.0) (2026-04-15)

- Switch to pnpm, plus simplifications (#57)

## [2.2.11](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.8...v2.2.11) (2026-03-24)

- Run the snapshot tests on a nightly cron job

## [2.2.8](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.7...v2.2.8) (2026-01-30)

- Add a panel for resuming an existing NCBI BLAST RID
- Cache more of the BLAST results

## [2.2.7](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.5...v2.2.7) (2026-01-30)

- Read the version from a generated `version.ts` rather than package.json

## [2.2.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.4...v2.2.5) (2026-01-25)

- Dependency bumps

## [2.2.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.3...v2.2.4) (2026-01-25)

- Save NCBI BLAST results to IndexedDB (#55) and load an MSA from IndexedDB
  (#51)
- Connect the MSA view with the protein structure view (#49)
- Add an extension point for launching an MSA view from e.g. the URL bar (#47)
- Add MAF viewer integration (#52)
- Add puppeteer-based testing against multiple JBrowse versions (#53)

## [2.2.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.2...v2.2.3) (2025-10-14)

- Update g2p_mapper, fix tsc errors

## [2.2.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.1...v2.2.2) (2025-10-13)

- Create a general concept of an MSA data adapter (#43)
- Use a transcript's associated MSA dataset when it has one (#44)
- Fix the cache key

## [2.2.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.0...v2.2.1) (2025-05-29)

- Drop the msa root configuration schema, which broke plugin load

## [2.2.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.1.0...v2.2.0) (2025-05-29)

- Add a quick-blastp option to the in-app NCBI BLAST workflow (#41)

## [2.1.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.6...v2.1.0) (2025-05-23)

- Add the Ensembl GeneTree widget directly in the app (#39)

## [2.0.6](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.5...v2.0.6) (2025-05-19)

- Output distconfig.json
- Add lint to CI

## [2.0.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.4...v2.0.5) (2025-05-19)

- Split the watch script, and fix the plugin import

## [2.0.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.3...v2.0.4) (2024-08-31)

- Improve BLAST error handling and feature sequence fetching

## [2.0.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.2...v2.0.3) (2024-08-09)

- Dependency bumps

## [2.0.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.1...v2.0.2) (2024-07-16)

- Add MAFFT as an alignment option
- Add error handling to the BLAST job

## [2.0.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.0...v2.0.1) (2024-07-09)

- Dependency bumps

## [2.0.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.18...v2.0.0) (2024-07-08)

- Launch an MSA view for a gene by running an NCBI BLAST search from the
  browser, against nr or nr_clustered_seq
- Sync mouseover between the MSA and the linear genome view, and click to
  navigate to the genome (#29)
- Map genome<->protein coordinates with g2p_mapper
- Build with esbuild for both development and production (#37)
- Relicense as MIT

## [1.0.18](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.17...v1.0.18) (2022-01-10)

- Fix clicking on node labels

## [1.0.17](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.16...v1.0.17) (2021-11-04)

- Avoid Link redirection at react-msaview importform

## [1.0.16](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.15...v1.0.16) (2021-10-22)

- Update to latest react-msaview

## [1.0.15](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.14...v1.0.15) (2021-10-22)

- Change to add to 'Add' top level menu

## [1.0.14](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.13...v1.0.14) (2021-03-17)

- Fix session link loading from distconfig.json

## [1.0.13](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.12...v1.0.13) (2021-03-17)

- Factor out code into the react-msaview package on NPM, and make the plugin
  more of a wrapper around this module

## [1.0.12](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.11...v1.0.12) (2021-02-12)

- Avoid scrolling too far right

## [1.0.11](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.10...v1.0.11) (2021-02-12)

- Add version number from package.json to about panel

## [1.0.10](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.9...v1.0.10) (2021-02-11)

- Fix scrolling for large MSA that loads after tree

## [1.0.9](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.8...v1.0.9) (2021-02-11)

- Fix for MSA loading bar when tree only is displayed

## [1.0.8](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.7...v1.0.8) (2021-02-11)

- Fix for side scrolling half rendered letters in MSA
- drawNodeBubbles option

## [1.0.7](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.6...v1.0.7) (2021-02-10)

- Move yarn build script to prepare script in package.jsom

## [1.0.6](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.5...v1.0.6) (2021-02-10)

- Use postversion to run build so that the accurate version is encoded into the
  release binary

## [1.0.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.3...v1.0.5) (2021-02-10)

- Add prebuild clean

## [1.0.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.3...v1.0.5) (2021-02-10)

- Fix running build before release

## [1.0.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.2...v1.0.3) (2021-02-10)

- Re-release

## [1.0.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.1...v1.0.2) (2021-02-10)

- Ensure clean build with prebuild rm -rf dist

## [1.0.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.0...v1.0.1) (2021-02-10)

- Fix for making demo config on unpkg

## [1.0.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.0...v1.0.0) (2021-02-10)

### Features

- Vertical virtualized scrolling of phylogenetic tree
- Vertical and horizontal virtualized scrolling of multiple sequence alignment
  as a newick tree embedded in stockholm metadata
- View metadata about alignment from MSA headers (e.g. stockholm)
- Collapse subtrees with click action on branches
- The collapse subtree action hides gaps that were introduced by that subtree in
  the rest of the alignment
- Allows "zooming out" by setting tiny rowHeight/colWidth settings
- Allows changing color schemes, with jalview, clustal, and other color schemes
- Allows toggling the branch length rendering for the phylogenetic tree
- Can share sessions with other users which will send relevant settings and
  links to files to automatically open your results
- The tree or the MSA panel can be loaded separately from each other

### File format supports

- FASTA formatted for MSA (e.g. gaps already inserted)
- Stockholm files (e.g. .stock file, with or without embedded newick tree, uses
  stockholm-js parser. also supports "multi-stockholm" files with multiple
  alignments embedded in a single file)
- Clustal files (e.g. .aln file, uses clustal-js parser)
- Newick (tree can be loaded separately as a .nh file)
