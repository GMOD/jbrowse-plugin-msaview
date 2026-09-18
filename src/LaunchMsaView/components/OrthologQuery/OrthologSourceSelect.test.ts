import { expect, test } from 'vitest'

import { validOrthologSource } from './OrthologSourceSelect'

test('a stored source this version knows comes back as it went in', () => {
  expect(validOrthologSource('panther')).toBe('panther')
  expect(validOrthologSource('uniref')).toBe('uniref')
})

// the Orthologs tab is the dialog's default, and it looked its helper text up
// by whatever was stored, so an unknown value threw on open
test('anything else falls back to NCBI', () => {
  expect(validOrthologSource('ensembl')).toBe('ncbi')
  expect(validOrthologSource(undefined)).toBe('ncbi')
  expect(validOrthologSource({ source: 'panther' })).toBe('ncbi')
})
