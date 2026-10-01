import type { JBrowsePluginMsaViewModel } from './model'

export function isMsaView(view: {
  type: string
}): view is JBrowsePluginMsaViewModel {
  return view.type === 'MsaView'
}
