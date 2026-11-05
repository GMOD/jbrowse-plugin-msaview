import { expect, test } from 'vitest'

import {
  alignmentRowName,
  isMissingFile,
  parseOrthogroups,
  parseResolvedGeneTrees,
  resultsFile,
} from './parseResults'

test('a versioned protein id also answers to its unversioned form', () => {
  const human = parseOrthogroups(
    'Orthogroup\tHuman\tMouse\nOG0000001\tENSP00000269305.4\tENSMUSP00000104298.3, ENSMUSP00000005371\n',
  ).get('Human')
  expect(human?.get('ENSP00000269305.4')?.orthogroup).toBe('OG0000001')
  expect(human?.get('ENSP00000269305')).toEqual({
    orthogroup: 'OG0000001',
    id: 'ENSP00000269305.4',
  })
})

test('an unversioned alias never displaces a real id of the same name', () => {
  const groups = parseOrthogroups(
    'Orthogroup\tA\nOG0000001\tP1.2\nOG0000002\tP1\n',
  )
  expect(groups.get('A')?.get('P1')?.orthogroup).toBe('OG0000002')
  const reversed = parseOrthogroups(
    'Orthogroup\tA\nOG0000002\tP1\nOG0000001\tP1.2\n',
  )
  expect(reversed.get('A')?.get('P1')?.orthogroup).toBe('OG0000002')
})

test("a name two species share stays each species' own", () => {
  const groups = parseOrthogroups(
    'Orthogroup\tchicken\thuman\r\nOG0013180\t\tADAM32\r\nOG0015286\tADAM32\t\r\n',
  )
  expect(groups.get('human')?.get('ADAM32')?.orthogroup).toBe('OG0013180')
  expect(groups.get('chicken')?.get('ADAM32')?.orthogroup).toBe('OG0015286')
})

test("an alignment row is the species, made OrthoFinder's prefix, and the id", () => {
  expect(alignmentRowName('melanogaster', 'Dmel_CG2671')).toBe(
    'melanogaster_Dmel_CG2671',
  )
  expect(alignmentRowName('Homo sapiens.v2', 'P1')).toBe('Homo_sapiens_v2_P1')
})

test('only a 403, 404 or absent local file reads as missing', () => {
  expect(isMissingFile(new Error('HTTP 404 fetching https://x/a'))).toBe(true)
  expect(isMissingFile(new Error('HTTP 403 fetching https://x/a'))).toBe(true)
  expect(isMissingFile(new Error("ENOENT: no such file, open '/a'"))).toBe(true)
  expect(isMissingFile(new Error('HTTP 503 fetching https://x/a'))).toBe(false)
  expect(isMissingFile(new TypeError('Failed to fetch'))).toBe(false)
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
