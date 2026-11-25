// @vitest-environment jsdom
import React from 'react'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import QueryRowSelector from './QueryRowSelector'

import type { SequenceStatus } from './SequenceStatus'

afterEach(() => {
  cleanup()
})

function renderUnmatched(sequenceStatus: SequenceStatus) {
  render(
    <QueryRowSelector
      names={['seq1', 'seq2']}
      querySeqName=""
      setQuerySeqName={() => {}}
      isAutoDetected={false}
      sequenceStatus={sequenceStatus}
    />,
  )
}

test('no row is blamed while the protein is still translating', () => {
  renderUnmatched('loading')
  expect(screen.queryByRole('alert')).toBeNull()
})

test('a protein that arrived and matched nothing asks for a hand pick', () => {
  renderUnmatched('ready')
  expect(screen.getByRole('alert').textContent).toMatch(
    /No row matched your protein sequence/,
  )
})

test('a protein that never arrived is not reported as a failed match', () => {
  renderUnmatched('error')
  expect(screen.getByRole('alert').textContent).toMatch(
    /no protein sequence to match/,
  )
})
