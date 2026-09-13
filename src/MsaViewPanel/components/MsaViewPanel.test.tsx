// @vitest-environment jsdom
import React from 'react'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import MsaViewPanel from './MsaViewPanel'

import type { JBrowsePluginMsaViewModel } from '../model'

// react-msaview's MSAView is the "nothing is launching" branch and wants a real
// MST model; a marker is enough to say the panel reached it
vi.mock('react-msaview', () => ({
  MSAView: () => <div>the alignment</div>,
}))

function panel(model: Partial<JBrowsePluginMsaViewModel>) {
  return render(<MsaViewPanel model={model as JBrowsePluginMsaViewModel} />)
}

afterEach(() => {
  cleanup()
})

test('an alignment with no pending launch draws itself', () => {
  panel({ progress: '' })
  expect(screen.getByText('the alignment')).toBeTruthy()
})

test('a running BLAST shows its progress, not an empty alignment', () => {
  panel({
    blastParams: { proteinSequence: 'MKV' } as never,
    progress: 'Submitting query',
  })
  expect(screen.queryByText('the alignment')).toBeNull()
  expect(screen.getByText(/Running EBI BLAST/)).toBeTruthy()
  expect(screen.getByText('Submitting query')).toBeTruthy()
})

// the bug this file was written for: an ortholog launch sets orthologParams
// rather than blastParams, and the panel keyed on blastParams alone -- so it
// rendered an empty MSAView for the minutes the alignment takes, and drew
// nothing at all when the launch failed
test('a running ortholog launch shows its progress', () => {
  panel({
    orthologParams: { taxId: 9606 } as never,
    progress: 'Resolving orthologs',
  })
  expect(screen.queryByText('the alignment')).toBeNull()
  expect(screen.getByText(/Building ortholog alignment/)).toBeTruthy()
  expect(screen.getByText('Resolving orthologs')).toBeTruthy()
})

test('a failed ortholog launch shows why', () => {
  panel({
    orthologParams: { taxId: 9606 } as never,
    progress: '',
    error: new Error('Only 1 ortholog(s) found for this gene'),
  })
  expect(screen.getByText(/Only 1 ortholog\(s\) found/)).toBeTruthy()
})

// an indexed view keeps its init -- it is how the block is refetched on the
// next session -- so the panel cannot read init alone as "still launching"
test('an indexed view with its alignment draws it, init and all', () => {
  panel({
    init: { msaIndexedLocation: { uri: 'msa.fa.gz' }, msaName: 'ENST1' },
    dataInitialized: true,
    progress: '',
  })
  expect(screen.getByText('the alignment')).toBeTruthy()
})

test('a failed init shows why', () => {
  panel({
    init: { msaName: 'ENST00000288602' },
    progress: '',
    error: new Error('No alignment named ENST00000288602 in msa.fa.gz'),
  })
  expect(screen.queryByText('the alignment')).toBeNull()
  expect(screen.getByText(/No alignment named ENST00000288602/)).toBeTruthy()
})

// a launch runs for 10+ minutes, so leaving with no way out means watching it
test('a running launch offers a way out', () => {
  const cancelLaunch = vi.fn()
  panel({
    blastParams: { proteinSequence: 'MKV' } as never,
    progress: 'Re-checking BLAST status in... 7',
    cancelLaunch,
  })
  screen.getByRole('button', { name: 'Cancel' }).click()
  expect(cancelLaunch).toHaveBeenCalled()
})

// the request outlives the failure -- it is what a reload resubmits -- so a
// failed launch that only drew the error was a dead end that re-ran the EBI job
// on every reload
test('a failed launch can be retried or dismissed', () => {
  const cancelLaunch = vi.fn()
  const retryLaunch = vi.fn()
  panel({
    blastParams: { proteinSequence: 'MKV' } as never,
    progress: '',
    error: new Error('No hits found'),
    cancelLaunch,
    retryLaunch,
  })
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  screen.getByRole('button', { name: 'Retry' }).click()
  expect(retryLaunch).toHaveBeenCalled()
  screen.getByRole('button', { name: 'Dismiss' }).click()
  expect(cancelLaunch).toHaveBeenCalled()
})

test('a running job links out to it', () => {
  panel({
    blastParams: { proteinSequence: 'MKV' } as never,
    progress: 'Re-checking BLAST status in... 7',
    rid: 'ncbiblast-R20260826-123456-0001-abc',
  })
  const link = screen.getByRole('link')
  expect(link.getAttribute('href')).toContain(
    'jobId=ncbiblast-R20260826-123456-0001-abc',
  )
})
