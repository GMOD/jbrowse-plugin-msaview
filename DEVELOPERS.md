# Developing jbrowse-plugin-msaview

For launching views from URLs or code, see
[docs/launching.md](docs/launching.md) and
[docs/launch-parameters.md](docs/launch-parameters.md). This page covers
building, testing and releasing the plugin itself.

## Running locally

Run jbrowse-web on port 3000, then in this repo:

```bash
pnpm install
pnpm start
```

`pnpm start` rebuilds on change and serves the repo on `http://localhost:9000`;
`config.json` loads the plugin from there, so open
http://localhost:3000/?config=http://localhost:9000/config.json.

The alignment viewer itself is
[react-msaview](https://github.com/GMOD/react-msaview); this plugin adds the
JBrowse view type, the launch dialog, the ortholog and search sources, and the
genome connection.

## Checks

| Command                     | What it checks                                                     |
| --------------------------- | ------------------------------------------------------------------ |
| `pnpm lint`                 | oxlint with type information                                       |
| `pnpm test`                 | Unit tests plus the e2e suite on a freshly fetched nightly JBrowse |
| `pnpm test:setup`           | Creates the released JBrowse instances the version matrix runs on  |
| `pnpm test:versions`        | The whole suite again on each of those releases                    |
| `pnpm check-host-externals` | Every externalized import is one every supported host re-exports   |
| `pnpm host-compat`          | Boots `dist/` on hosted JBrowse releases                           |

The version matrix and `host-compat` exist because a published bundle reaches
configs already in the wild on every host a user runs, and the failures that
matter there pass tsc and lint. `CLAUDE.md` records which legs to keep and why.

## Screenshots

The E2E suites write reference PNGs under `test-screenshots/`. puppeteer
captures aren't pixel-deterministic (antialiasing, WebGL/canvas, font hinting),
so `scripts/pngSnapshot.mjs` normalizes each capture through `pngquant --nofs`
and only overwrites a committed PNG when more than ~1% of pixels differ, so
unrelated runs don't churn git. Tune the threshold with `SCREENSHOT_DIFF_RATIO`
(`0` always rewrites, `0.05` tolerates larger wobble). `pngquant` is optional;
without it the raw PNG is used.

### The README figure

`img/1.png` is a capture of the README's demo link, not a hand-made screenshot.
`pnpm readme-figure` loads the first `session=spec-` link in the README on the
hosted `main` build with the local `dist/` answering for this plugin, drops the
ProteinView (protein3d's, and molstar gets no WebGL in headless Chrome), and
writes the figure through the same tolerance as the test references. The
`version` lifecycle runs it, so each release commits a figure of its own UI.
When the capture fails there, the script prints a warning and keeps the old
figure, so a slow gmod.org or UCSC cannot hold up a release.

Change the demo link and the figure follows at the next release. Run
`pnpm build && pnpm readme-figure` to see it sooner.

## Publishing

```bash
pnpm version patch
```

`preversion` waits for green CI, checks the host dependency pins, lints, builds
and boots the bundle on hosted JBrowse releases; `postversion` pushes the tag,
and CI publishes to npm and writes the GitHub release from `CHANGELOG.md`.
