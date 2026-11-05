import { SimpleFeature } from '@jbrowse/core/util'
import { expect, test } from 'vitest'

import { pickSelectedId } from './useTranscriptSelection'

const transcript = (id: string) =>
  new SimpleFeature({ uniqueId: id, refName: '2L', start: 0, end: 10 })
const options = ['t1', 't2', 't3'].map(transcript)

test('with no hasData the selection always stands', () => {
  expect(pickSelectedId('t2', options, undefined)).toBe('t2')
})

test('a selection with data stands', () => {
  expect(pickSelectedId('t2', options, () => true)).toBe('t2')
})

test('a selection without data moves to the first option that has some', () => {
  expect(pickSelectedId('t1', options, t => t.id() !== 't1')).toBe('t2')
})

test('with no option holding data the selection stands', () => {
  expect(pickSelectedId('t3', options, () => false)).toBe('t3')
})
