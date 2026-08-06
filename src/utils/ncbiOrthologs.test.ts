import { describe, expect, test } from 'vitest'

import { dedupeLabels, parseFasta } from './ncbiOrthologs'

describe('dedupeLabels', () => {
  test('sanitizes to single tokens', () => {
    // labels are used identically as FASTA headers, Newick leaf names and GFF
    // seq_ids, so anything that would need quoting in one of those is stripped
    expect(dedupeLabels(['house mouse', 'Norway rat'])).toEqual([
      'house_mouse',
      'Norway_rat',
    ])
    expect(dedupeLabels(['Frog (X. tropicalis)'])).toEqual([
      'Frog_X_tropicalis',
    ])
  })

  test('suffixes collisions rather than overwriting a row', () => {
    expect(dedupeLabels(['a b', 'a-b', 'a_b'])).toEqual([
      'a_b',
      'a_b_2',
      'a_b_3',
    ])
  })

  test('falls back for a name with no usable characters', () => {
    expect(dedupeLabels(['...', '...'])).toEqual(['row', 'row_2'])
  })
})

describe('parseFasta', () => {
  test('keys by the first header token and joins wrapped lines', () => {
    const map = parseFasta(
      ['>NP_000537.3 cellular tumor antigen p53', 'MEEP', 'QSDP', ''].join(
        '\n',
      ),
    )
    expect(map.get('NP_000537.3')).toBe('MEEPQSDP')
  })

  test('reads every record of a multi-FASTA', () => {
    const map = parseFasta(
      ['>A one', 'MMM', '>B two', 'KKK', '>C three', 'LLL'].join('\n'),
    )
    expect([...map.keys()]).toEqual(['A', 'B', 'C'])
    expect(map.get('C')).toBe('LLL')
  })

  test('returns nothing for a response that carried no records', () => {
    // efetch answers an unknown accession with an error body, not a 4xx, so a
    // caller that assumed "text back = sequences" would build empty rows
    expect(parseFasta('Error: CEFetchPApplication::proxy_stream()').size).toBe(
      0,
    )
  })
})
