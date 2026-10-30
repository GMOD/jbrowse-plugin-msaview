import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import { expect, test, vi } from 'vitest'

import MsaViewPlugin from './index'

import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

// the view's autoruns reach for a session on every change, and there is none
// around a bare model
vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => ({ views: [], hovered: undefined }),
}))

// BgzipFastaMsaAdapter extends the sequence plugin's adapter, which a host
// always provides and this repo does not install
class SequenceStub extends Plugin {
  name = 'SequenceStub'
  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BgzipFastaAdapter',
          configSchema: ConfigurationSchema('BgzipFastaAdapter', {}),
          getAdapterClass: async () => {
            throw new Error('not used')
          },
        }),
    )
  }
}

// jb.waitReady, the app's ready marker and screenshot tools read an absent
// showLoading as finished, so a view without one reads ready while it loads.
// The same check for jbrowse-components' own views is
// products/jbrowse-web/src/schemaTests/ElementsReportLoading.test.ts there.
test('every view type this plugin registers publishes showLoading', async () => {
  const pluginManager = new PluginManager([
    new SequenceStub(),
    new MsaViewPlugin(),
  ])
  pluginManager.createPluggableElements()
  const views = pluginManager.getElementTypesInGroup('view') as ViewType[]
  expect(views.length).toBeGreaterThan(0)
  await Promise.all(views.map(t => t.loadStateModel()))
  const gaps = views.flatMap(t => {
    const view = t.stateModel.create({ type: t.name }, { pluginManager })
    const keys = (
      'exportSvg' in view
        ? ['showLoading', 'initialized', 'error']
        : ['showLoading']
    ).filter(k => !(k in view))
    return keys.length ? [`${t.name}: ${keys.join(', ')}`] : []
  })
  expect(gaps).toEqual([])
})
