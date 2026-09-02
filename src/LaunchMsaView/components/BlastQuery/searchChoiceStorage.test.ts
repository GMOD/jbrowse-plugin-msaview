import { expect, test } from 'vitest'

import { validMsaAlgorithm, validSearchChoice } from './searchChoiceStorage'

test('a stored pair both services recognise comes back as it went in', () => {
  expect(
    validSearchChoice({ program: 'phmmer', database: 'swissprot' }),
  ).toEqual({
    program: 'phmmer',
    database: 'swissprot',
  })
})

test('a database the stored program does not have falls back to the defaults', () => {
  // uniprotkb_swissprot is blastp's name for it; sending it to phmmer is a 400
  // from EBI minutes after Submit
  expect(
    validSearchChoice({ program: 'phmmer', database: 'uniprotkb_swissprot' }),
  ).toEqual({ program: 'blastp', database: 'uniprotkb_swissprot' })
  // uniprotkb_reference_proteomes shipped as a menu entry EBI rejects, and 3.0.0
  // is old enough that someone's storage still holds it
  expect(
    validSearchChoice({
      program: 'blastp',
      database: 'uniprotkb_reference_proteomes',
    }),
  ).toEqual({ program: 'blastp', database: 'uniprotkb_swissprot' })
})

test('storage holding something else entirely falls back rather than throwing', () => {
  for (const stored of [null, undefined, 'blastp', 42, {}, []]) {
    expect(validSearchChoice(stored)).toEqual({
      program: 'blastp',
      database: 'uniprotkb_swissprot',
    })
  }
})

test('an unknown algorithm falls back to clustalo', () => {
  expect(validMsaAlgorithm('mafft')).toBe('mafft')
  expect(validMsaAlgorithm('t_coffee')).toBe('clustalo')
  expect(validMsaAlgorithm(null)).toBe('clustalo')
})
