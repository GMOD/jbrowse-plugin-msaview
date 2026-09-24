interface Region {
  refName: string
  start: number
  end: number
}

interface LinkedView {
  type: string
  connectedViewId?: string
  connectedClickHighlights: Region[]
  connectedHoverHighlights: Region[]
}

export function connectedHighlights(
  views: readonly { type: string }[],
  genomeViewId: string,
  genomeHovered: boolean,
) {
  return views
    .filter(isLinkedMsaView)
    .filter(v => v.connectedViewId === genomeViewId)
    .flatMap(v => [
      ...v.connectedClickHighlights,
      ...(genomeHovered ? [] : v.connectedHoverHighlights),
    ])
}

function isLinkedMsaView(view: { type: string }): view is LinkedView {
  return view.type === 'MsaView'
}
