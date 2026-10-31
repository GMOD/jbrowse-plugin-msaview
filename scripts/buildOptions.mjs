/**
 * The ESM bundle a JBrowse 5 host loads from a config's `esmUrl`.
 *
 * core's `hostShim` binds every import the host re-exports (React, MobX, MUI,
 * `@jbrowse/core` subpaths) to the host's copy on `globalThis.JBrowseExports`,
 * so the plugin shares the host's hooks, MobX and configuration registry rather
 * than carrying its own. It also fails the build on a name the host does not
 * serve, which is what `StepContent` and `createFilterOptions` needed (see
 * CLAUDE.md). `pluginName` is the config's plugins-entry name, quoted in the
 * error a host lacking an export throws.
 */
import { hostShim } from '@jbrowse/core/ReExports/hostShim'

export function buildOptions(shim = {}) {
  return {
    entryPoints: ['src/index.ts'],
    bundle: true,
    // react-msaview sits behind the view's state-model thunk and lazy()
    // components, which splitting emits as chunks under dist/chunks/ resolved
    // against the entry's own url, on the main thread and in the RPC worker
    // alike
    format: 'esm',
    splitting: true,
    outdir: 'dist',
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    plugins: [hostShim({ pluginName: 'MsaView', ...shim })],
  }
}
