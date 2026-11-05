import { SimpleFeature } from '@jbrowse/core/util'
import { expect, test } from 'vitest'

import { featureMatchesId } from './util'

const transcript = new SimpleFeature({
  uniqueId: 'u1',
  refName: 'chr17',
  start: 0,
  end: 10,
  id: 'ENST00000269305.9',
  transcript_id: 'ENST00000269305.9',
  gene_name: 'TP53',
})

test('a transcript matches a dataset keyed by transcript id', () => {
  expect(featureMatchesId(transcript, 'ENST00000269305.9')).toBe(true)
})

test('a transcript matches a dataset keyed by its gene symbol', () => {
  expect(featureMatchesId(transcript, 'TP53')).toBe(true)
  expect(featureMatchesId(transcript, 'TP63')).toBe(false)
})
