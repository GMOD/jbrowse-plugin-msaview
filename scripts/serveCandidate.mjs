// Answers a hosted JBrowse's requests for this plugin with a local build, so a
// real shipped config loads the candidate instead of what the store serves.
// Shared by host-compat-probe.mjs and readme-figure.mjs.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const PACKAGE_PATH = '/jbrowse-plugin-msaview/'

export function candidateServer(bundlePath) {
  const bundle = fs.readFileSync(bundlePath, 'utf8')
  const bundleDir = path.dirname(bundlePath)
  const mainName = path.basename(bundlePath)

  // core@main resolves a config's `storePlugin` entries through the v2 store
  // manifest, which pins a versioned url AND a subresource-integrity hash — so a
  // substituted bundle fails SRI on that host however valid it is. The manifest
  // is rewritten so this plugin's integrity matches the candidate being served
  // (not stripped: the SRI machinery itself stays exercised), and every other
  // plugin's pin is left alone.
  const bundleIntegrity = `sha384-${crypto
    .createHash('sha384')
    .update(bundle)
    .digest('base64')}`

  let manifestPromise
  function rewrittenStoreManifest(url) {
    manifestPromise ??= (async () => {
      const manifest = await (await fetch(url)).json()
      for (const plugin of manifest.plugins ?? []) {
        if (plugin.url?.includes(PACKAGE_PATH)) {
          plugin.integrity = bundleIntegrity
          for (const version of plugin.versions ?? []) {
            version.integrity = bundleIntegrity
          }
        }
      }
      return JSON.stringify(manifest)
    })()
    return manifestPromise
  }

  // Serves the whole local dist for the plugin's store path, not just the one
  // file: a build that code-splits fetches sibling chunks by their own hashed
  // names, and answering those with the main bundle produces a failure that
  // looks like a host incompatibility but is a probe bug.
  //
  // Fetch patterns rather than page.setRequestInterception: the latter pauses
  // every request, including the RPC workers' own, which puppeteer never sees
  // and so never resumes -- tracks stall on their first byte range.
  function candidateBody(url) {
    const name = path.basename(new URL(url).pathname)
    const sibling = path.join(bundleDir, name)
    if (!url.includes(PACKAGE_PATH) || !name.endsWith('.js')) {
      return undefined
    }
    return name !== mainName && fs.existsSync(sibling)
      ? fs.readFileSync(sibling, 'utf8')
      : bundle
  }

  return async function serveCandidate(page) {
    const client = await page.createCDPSession()
    client.on('Fetch.requestPaused', async ({ requestId, request }) => {
      try {
        const isManifest = /\/plugin-store\/.*plugins\.json/.test(request.url)
        const body = isManifest
          ? await rewrittenStoreManifest(request.url)
          : candidateBody(request.url)
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
}
