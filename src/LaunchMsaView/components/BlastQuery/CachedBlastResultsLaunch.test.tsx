// @vitest-environment jsdom
import React from 'react'

import { SimpleFeature } from '@jbrowse/core/util'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { observer } from 'mobx-react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { launchMsaView } from '../../../utils/launchMsaView'
import { LAUNCH_PLACEMENT_KEY } from '../../../utils/workspaces'
import { useLaunchSubmit } from '../launchConnectedView'
import CachedBlastResults from './CachedBlastResults'

import type { CachedBlastResult } from '../../../utils/blastCache'
import type { AbstractTrackModel } from '@jbrowse/core/util'

const tiling = { id: 'session', setUseWorkspaces() {}, setPendingMove() {} }
const view = { id: 'lgv' }

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => tiling,
  getContainingView: () => view,
}))
vi.mock('../../../utils/launchMsaView', () => ({
  launchMsaView: vi.fn(),
}))

const mockLaunch = vi.mocked(launchMsaView)

beforeEach(() => {
  localStorage.clear()
  mockLaunch.mockReset()
  mockLaunch.mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  cleanup()
})

const result: CachedBlastResult = {
  id: 'k',
  geneName: 'TP53',
  proteinSequence: 'MKV',
  blastDatabase: 'uniprotkb_swissprot',
  msa: '>QUERY\nMKV',
  tree: '',
  treeMetadata: '{}',
  rid: 'r',
  timestamp: 0,
}

const feature = new SimpleFeature({
  uniqueId: 'gene1',
  refName: 'chr1',
  start: 0,
  end: 10,
})
const model = {} as unknown as AbstractTrackModel

const Harness = observer(function Harness() {
  const { submit } = useLaunchSubmit(() => {})
  return (
    <CachedBlastResults
      model={model}
      submit={submit}
      feature={feature}
      cached={{
        results: [result],
        error: undefined,
        isLoading: false,
        handleDelete: async () => {},
        handleClearAll: async () => {},
      }}
    />
  )
})

test('a double click while the view loads opens one view', () => {
  render(<Harness />)
  const row = screen.getByText(/TP53/)
  fireEvent.click(row)
  fireEvent.click(row)
  expect(mockLaunch).toHaveBeenCalledTimes(1)
})

test('opening a cached result remembers the placement it opened with', () => {
  render(<Harness />)
  fireEvent.click(screen.getByText(/TP53/))
  expect(mockLaunch.mock.calls[0]?.[1].placement).toBe('splitRight')
  expect(localStorage.getItem(LAUNCH_PLACEMENT_KEY)).toBe('splitRight')
})
