import React from 'react'

import { observer } from 'mobx-react'
import { MSAView } from 'react-msaview'

import { JBrowsePluginMsaViewModel } from '../model'

const MsaViewPanel = observer(function MsaViewPanel2({
  model,
}: {
  model: JBrowsePluginMsaViewModel
}) {
  return <MSAView model={model} />
})

export default MsaViewPanel
