// Answers a hosted JBrowse's requests for this plugin with a local build, so a
// real shipped config loads the candidate instead of what the store serves.
// Shared by host-compat-probe.mjs and readme-figure.mjs.
import fs from 'node:fs'
import path from 'node:path'

const PACKAGE_PATH = '/jbrowse-plugin-msaview/'
const PUBLISHED_ESM =
  'https://jbrowse.org/plugins/jbrowse-plugin-msaview/latest/dist/jbrowse-plugin-msaview.esm.js'

export function candidateServer(entryPath) {
  const dist = path.dirname(entryPath)
  const entryName = path.basename(entryPath)
  const publishedEntryName = path.basename(PUBLISHED_ESM)

  // core@main resolves a config's `storePlugin` entry through the v2 store
  // manifest, which names this plugin's build. The manifest is rewritten so
  // every build of this plugin is the ESM entry at its store path, which the
  // handler below answers from the local dist; every other plugin is left
  // alone.
  let manifestPromise
  function rewrittenStoreManifest(url) {
    manifestPromise ??= (async () => {
      const manifest = await (await fetch(url)).json()
      for (const plugin of manifest.plugins ?? []) {
        if (plugin.name === 'MsaView') {
          for (const build of [plugin, ...(plugin.versions ?? [])]) {
            delete build.url
            delete build.umdUrl
            delete build.integrity
            build.esmUrl = PUBLISHED_ESM
          }
        }
      }
      return JSON.stringify(manifest)
    })()
    return manifestPromise
  }

  // Resolved by path under dist/: the entry imports its chunks from
  // dist/chunks/ relative to its own url, and answering a chunk request with
  // the entry produces a failure that looks like a host incompatibility but is
  // a probe bug. A path the local dist lacks goes to the network and fails
  // there, loudly.
  function candidateFile(url) {
    if (!url.includes(PACKAGE_PATH)) {
      return undefined
    }
    const rel = new URL(url).pathname.split('/dist/').slice(1).join('/dist/')
    if (rel === publishedEntryName || rel === entryName) {
      serveCandidate.entryRequests += 1
      return entryPath
    }
    const local = path.join(dist, rel)
    return rel.endsWith('.js') && fs.existsSync(local) ? local : undefined
  }

  // Fetch patterns rather than page.setRequestInterception: the latter pauses
  // every request, including the RPC workers' own, which puppeteer never sees
  // and so never resumes -- tracks stall on their first byte range.
  async function serveCandidate(page) {
    const client = await page.createCDPSession()
    client.on('Fetch.requestPaused', async ({ requestId, request }) => {
      try {
        const isManifest = /\/plugin-store\/.*plugins\.json/.test(request.url)
        const file = isManifest ? undefined : candidateFile(request.url)
        const body = isManifest
          ? await rewrittenStoreManifest(request.url)
          : file && fs.readFileSync(file, 'utf8')
        await (body === undefined
          ? client.send('Fetch.continueRequest', { requestId })
          : client.send('Fetch.fulfillRequest', {
              requestId,
              responseCode: 200,
              responseHeaders: [
                {
                  name: 'Content-Type',
                  value: isManifest
                    ? 'application/json'
                    : 'application/javascript',
                },
                { name: 'Access-Control-Allow-Origin', value: '*' },
              ],
              body: Buffer.from(body).toString('base64'),
            }))
      } catch {
        await client
          .send('Fetch.continueRequest', { requestId })
          .catch(() => {})
      }
    })
    await client.send('Fetch.enable', {
      patterns: [
        { urlPattern: `*${PACKAGE_PATH}*` },
        { urlPattern: '*/plugin-store/*plugins.json*' },
      ],
    })
  }
  serveCandidate.entryRequests = 0
  return serveCandidate
}
