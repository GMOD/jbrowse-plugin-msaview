import { expect, test } from 'vitest'

import {
  parseOrthogroups,
  parseResolvedGeneTrees,
  resultsFile,
} from './parseResults'

test('a versioned protein id also answers to its unversioned form', () => {
  const groups = parseOrthogroups(
    'Orthogroup\tHuman\tMouse\nOG0000001\tENSP00000269305.4\tENSMUSP00000104298.3, ENSMUSP00000005371\n',
  )
  expect(groups.get('ENSP00000269305.4')).toBe('OG0000001')
  expect(groups.get('ENSP00000269305')).toBe('OG0000001')
  expect(groups.get('ENSMUSP00000005371')).toBe('OG0000001')
})

test('an unversioned alias never displaces a real id of the same name', () => {
  const groups = parseOrthogroups(
    'Orthogroup\tA\nOG0000001\tP1.2\nOG0000002\tP1\n',
  )
  expect(groups.get('P1')).toBe('OG0000002')
  const reversed = parseOrthogroups(
    'Orthogroup\tA\nOG0000002\tP1\nOG0000001\tP1.2\n',
  )
  expect(reversed.get('P1')).toBe('OG0000002')
})

test('Resolved_Gene_Trees.txt splits on the first colon-space only', () => {
  const trees = parseResolvedGeneTrees(
    'OG0000001: (A_x:0.1,B_y:0.2)n0;\nOG0000002: (C:1,D:2);\n',
  )
  expect(trees.get('OG0000001')).toBe('(A_x:0.1,B_y:0.2)n0;')
  expect(trees.size).toBe(2)
})

test('a results file resolves inside the folder however the folder is written', () => {
  const file = 'Orthogroups/Orthogroups.tsv'
  expect(
    resultsFile(
      { uri: 'https://x.org/run/Results_Nov05', locationType: 'UriLocation' },
      file,
    ),
  ).toMatchObject({ uri: `https://x.org/run/Results_Nov05/${file}` })
  expect(
    resultsFile(
      {
        uri: 'Results_Nov05/',
        baseUri: 'https://x.org/run/config.json',
        locationType: 'UriLocation',
      },
      file,
    ),
  ).toMatchObject({ uri: `https://x.org/run/Results_Nov05/${file}` })
  expect(
    resultsFile(
      { localPath: '/data/Results_Nov05/', locationType: 'LocalPathLocation' },
      file,
    ),
  ).toMatchObject({ localPath: `/data/Results_Nov05/${file}` })
})
