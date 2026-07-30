import fs from 'node:fs'
import http from 'node:http'
import * as esbuild from 'esbuild'
import { globalExternals } from '@fal-works/esbuild-plugin-global-externals'
import JBrowseReExports from '@jbrowse/core/ReExports/list'
import prettyBytes from 'pretty-bytes'

const isWatch = process.argv.includes('--watch')
const PORT = process.env.PORT ? +process.env.PORT : 9000

function createGlobalMap(jbrowseGlobals) {
  const globalMap = {}
  for (const global of jbrowseGlobals) {
    globalMap[global] = {
      varName: `JBrowseExports["${global}"]`,
      type: 'cjs',
    }
  }
  // Map @jbrowse/mobx-state-tree to mobx-state-tree for backwards compatibility
  // In v4.0.0+, JBrowse uses @jbrowse/mobx-state-tree but exports it as 'mobx-state-tree'
  // In v3.x, JBrowse used mobx-state-tree directly
  globalMap['@jbrowse/mobx-state-tree'] = {
    varName: `JBrowseExports["mobx-state-tree"]`,
    type: 'cjs',
  }
  return globalMap
}

const rebuildLogPlugin = {
  name: 'rebuild-log',
  setup({ onStart, onEnd }) {
    let time
    onStart(() => {
      time = Date.now()
    })
    onEnd(({ metafile, errors, warnings }) => {
      console.log(
        `Built in ${Date.now() - time} ms with ${errors.length} error(s) and ${warnings.length} warning(s)`,
      )
      if (metafile) {
        for (const [file, metadata] of Object.entries(metafile.outputs)) {
          console.log(`Wrote ${prettyBytes(metadata.bytes)} to ${file}`)
        }
      }
    })
  },
}

// Modules whose EXPORTED SHAPE differs across the MUI majors that hosts bundle.
// The key being present in JBrowseReExports is not enough: we build against the
// core we dev on, but the bundle runs on every host a config names.
//
// @mui/material/SvgIcon is the case that bit us. Released hosts (v4.0.0 through
// latest, on MUI 7) expose it as the SvgIcon component itself -- $$typeof,
// render, displayName -- while MUI 9 also hangs createSvgIcon off it, which is
// what @mui/icons-material v9 calls. Externalizing it meant 2.7.0 threw
// "createSvgIcon is not a function" while evaluating, so its global was never
// defined, so PluginLoader's Promise.all rejected and error-paged the entire
// app on every released host. 2.6.8 bundled it and was fine.
//
// Bundling it pulls in some MUI internals -- roughly 433KB -> 503KB -- and works
// on both MUI generations. Worth 70KB to not error-page every host.
const SHAPE_VARIES_BY_HOST = new Set(['@mui/material/SvgIcon'])
const globals = JBrowseReExports.filter(x => !SHAPE_VARIES_BY_HOST.has(x))
const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  globalName: 'JBrowsePluginMsaView',
  metafile: true,
  plugins: [globalExternals(createGlobalMap(globals)), rebuildLogPlugin],
  ...(isWatch
    ? { outfile: 'dist/out.js' }
    : {
        outfile: 'dist/jbrowse-plugin-msaview.umd.production.min.js',
        sourcemap: true,
        minify: true,
      }),
}

if (isWatch) {
  const ctx = await esbuild.context(config)
  const internalPort = PORT + 400
  const { hosts } = await ctx.serve({ servedir: '.', port: internalPort })

  http
    .createServer((req, res) => {
      const proxyReq = http.request(
        {
          hostname: hosts[0],
          port: internalPort,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        proxyRes => {
          // restore CORS after https://github.com/evanw/esbuild/releases/tag/v0.25.0 disabled it
          res.writeHead(proxyRes.statusCode, {
            ...proxyRes.headers,
            'Access-Control-Allow-Origin': '*',
          })
          proxyRes.pipe(res, { end: true })
        },
      )
      req.pipe(proxyReq, { end: true })
    })
    .listen(PORT)

  console.log(`Serving at http://${hosts[0]}:${PORT}`)
  await ctx.watch()
  console.log('Watching files...')
} else {
  const result = await esbuild.build(config)
  fs.writeFileSync('meta.json', JSON.stringify(result.metafile))
}
