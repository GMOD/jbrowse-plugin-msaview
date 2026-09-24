import { describe, expect, it } from 'vitest'

import { connectedHighlights } from './connectedHighlights'

const region = (start: number) => ({ refName: 'chr17', start, end: start + 3 })

function msaView(id: string | undefined, click: number, hover: number) {
  return {
    type: 'MsaView',
    connectedViewId: id,
    connectedClickHighlights: [region(click)],
    connectedHoverHighlights: [region(hover)],
  }
}

describe('connectedHighlights', () => {
  const views = [
    { type: 'LinearGenomeView' },
    msaView('lgv1', 100, 200),
    msaView('lgv2', 300, 400),
    msaView('lgv1', 500, 600),
  ]

  it('collects every MSA view linked to the genome view', () => {
    expect(connectedHighlights(views, 'lgv1', false).map(r => r.start)).toEqual(
      [100, 200, 500, 600],
    )
  })

  it('drops hover codons while the genome view is hovered', () => {
    expect(connectedHighlights(views, 'lgv1', true).map(r => r.start)).toEqual([
      100, 500,
    ])
  })

  it('draws a codon two views both highlight once', () => {
    const both = [msaView('lgv1', 100, 200), msaView('lgv1', 100, 200)]
    expect(connectedHighlights(both, 'lgv1', false).map(r => r.start)).toEqual([
      100, 200,
    ])
  })

  it('returns nothing for an unlinked genome view', () => {
    expect(connectedHighlights(views, 'lgv3', false)).toEqual([])
  })
})
