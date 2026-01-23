import fs from 'fs'
import * as esbuild from 'esbuild'
import { globalExternals } from '@fal-works/esbuild-plugin-global-externals'
import JBrowseReExports from '@jbrowse/core/ReExports/list'
import prettyBytes from 'pretty-bytes'

function createGlobalMap(jbrowseGlobals) {
  const globalMap = {}
  for (const global of jbrowseGlobals) {
    globalMap[global] = {
      varName: `JBrowseExports["${global}"]`,
      type: 'cjs',
    }
  }

  // Support both mobx-state-tree and @jbrowse/mobx-state-tree
  // They have the same API, so map @jbrowse/mobx-state-tree to mobx-state-tree
  // for backwards compatibility with older JBrowse versions
  globalMap['@jbrowse/mobx-state-tree'] = {
    varName: `JBrowseExports["mobx-state-tree"]`,
    type: 'cjs',
  }

  return globalMap
}

const result = await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  globalName: 'JBrowsePluginMsaView',
  sourcemap: true,
  outfile: 'dist/jbrowse-plugin-msaview.umd.production.min.js',
  metafile: true,
  minify: true,
  plugins: [
    globalExternals(createGlobalMap(JBrowseReExports)),
    {
      name: 'rebuild-log',
      setup({ onStart, onEnd }) {
        let time
        onStart(() => {
          time = Date.now()
        })
        onEnd(({ metafile, errors, warnings }) => {
          console.log(
            `Built in ${Date.now() - time} ms with ${
              errors.length
            } error(s) and ${warnings.length} warning(s)`,
          )
          if (!metafile) {
            return
          }
          const { outputs } = metafile
          for (const [file, metadata] of Object.entries(outputs)) {
            const size = prettyBytes(metadata.bytes)
            console.log(`Wrote ${size} to ${file}`)
          }
        })
      },
    },
  ],
})

fs.writeFileSync('meta.json', JSON.stringify(result.metafile))
