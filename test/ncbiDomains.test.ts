import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { efetchUrl } from '../src/utils/eutils'
import { parseCddDomains } from '../src/utils/ncbiDomains'

// Two protein records mirroring the shape of NCBI efetch
// (db=protein&rettype=gp&retmode=xml): a CDD-backed Region (a real domain), a
// Region without a CDD xref (a UniProt-propagated motif, should be ignored),
// and a non-Region feature (should be ignored).
const xml = `<GBSet>
  <GBSeq>
    <GBSeq_primary-accession>NP_002736</GBSeq_primary-accession>
    <GBSeq_accession-version>NP_002736.3</GBSeq_accession-version>
    <GBSeq_feature-table>
      <GBFeature>
        <GBFeature_key>Region</GBFeature_key>
        <GBFeature_intervals>
          <GBInterval><GBInterval_from>19</GBInterval_from><GBInterval_to>353</GBInterval_to></GBInterval>
        </GBFeature_intervals>
        <GBFeature_quals>
          <GBQualifier><GBQualifier_name>region_name</GBQualifier_name><GBQualifier_value>STKc_ERK1_2_like</GBQualifier_value></GBQualifier>
          <GBQualifier><GBQualifier_name>note</GBQualifier_name><GBQualifier_value>Catalytic domain; cd07849</GBQualifier_value></GBQualifier>
          <GBQualifier><GBQualifier_name>db_xref</GBQualifier_name><GBQualifier_value>CDD:270839</GBQualifier_value></GBQualifier>
        </GBFeature_quals>
      </GBFeature>
      <GBFeature>
        <GBFeature_key>Region</GBFeature_key>
        <GBFeature_intervals>
          <GBInterval><GBInterval_from>318</GBInterval_from><GBInterval_to>322</GBInterval_to></GBInterval>
        </GBFeature_intervals>
        <GBFeature_quals>
          <GBQualifier><GBQualifier_name>region_name</GBQualifier_name><GBQualifier_value>Cytoplasmic retention motif</GBQualifier_value></GBQualifier>
        </GBFeature_quals>
      </GBFeature>
      <GBFeature>
        <GBFeature_key>Site</GBFeature_key>
        <GBFeature_intervals>
          <GBInterval><GBInterval_from>31</GBInterval_from><GBInterval_to>34</GBInterval_to></GBInterval>
          <GBInterval><GBInterval_point>52</GBInterval_point></GBInterval>
          <GBInterval><GBInterval_point>149</GBInterval_point></GBInterval>
        </GBFeature_intervals>
        <GBFeature_quals>
          <GBQualifier><GBQualifier_name>site_type</GBQualifier_name><GBQualifier_value>active</GBQualifier_value></GBQualifier>
          <GBQualifier><GBQualifier_name>db_xref</GBQualifier_name><GBQualifier_value>CDD:270839</GBQualifier_value></GBQualifier>
        </GBFeature_quals>
      </GBFeature>
      <GBFeature>
        <GBFeature_key>CDS</GBFeature_key>
        <GBFeature_intervals>
          <GBInterval><GBInterval_from>1</GBInterval_from><GBInterval_to>360</GBInterval_to></GBInterval>
        </GBFeature_intervals>
      </GBFeature>
    </GBSeq_feature-table>
  </GBSeq>
  <GBSeq>
    <GBSeq_primary-accession>NP_417595</GBSeq_primary-accession>
    <GBSeq_accession-version>NP_417595.1</GBSeq_accession-version>
    <GBSeq_feature-table>
      <GBFeature>
        <GBFeature_key>Region</GBFeature_key>
        <GBFeature_intervals>
          <GBInterval><GBInterval_from>1</GBInterval_from><GBInterval_to>256</GBInterval_to></GBInterval>
        </GBFeature_intervals>
        <GBFeature_quals>
          <GBQualifier><GBQualifier_name>region_name</GBQualifier_name><GBQualifier_value>PRK10558</GBQualifier_value></GBQualifier>
          <GBQualifier><GBQualifier_name>db_xref</GBQualifier_name><GBQualifier_value>CDD:182547</GBQualifier_value></GBQualifier>
        </GBFeature_quals>
      </GBFeature>
    </GBSeq_feature-table>
  </GBSeq>
</GBSet>`

describe('parseCddDomains', () => {
  test('extracts CDD domains and skips non-CDD regions and other features', () => {
    const result = parseCddDomains(xml)

    // the kinase domain (Region) and active site (Site) are kept; the
    // non-CDD "Cytoplasmic retention motif" Region and the CDS are dropped
    const mapk = result.get('NP_002736.3')
    expect(mapk).toHaveLength(2)
    const domain = mapk!.find(m => m.signature.entry!.accession === '270839')!
    expect(domain.signature.entry).toEqual({
      name: 'STKc_ERK1_2_like',
      description: 'Catalytic domain; cd07849',
      accession: '270839',
    })
    expect(domain.locations).toEqual([{ start: 19, end: 353 }])
  })

  test('parses a Site as discontiguous locations with a distinct accession', () => {
    const site = parseCddDomains(xml)
      .get('NP_002736.3')!
      .find(m => m.signature.entry!.name === 'active')!
    expect(site.signature.entry!.accession).toBe('270839:active')
    expect(site.locations).toEqual([
      { start: 31, end: 34 },
      { start: 52, end: 52 },
      { start: 149, end: 149 },
    ])
  })

  test('keys results by both versioned and primary accession', () => {
    const result = parseCddDomains(xml)
    expect(result.get('NP_417595')).toEqual(result.get('NP_417595.1'))
    expect(result.get('NP_417595')).toHaveLength(1)
  })

  test('falls back to region_name when no note qualifier is present', () => {
    const result = parseCddDomains(xml)
    const entry = result.get('NP_417595.1')![0]!.signature.entry!
    expect(entry.name).toBe('PRK10558')
    expect(entry.description).toBe('PRK10558')
  })
})

// This is a REAL response recorded verbatim from NCBI on 2026-06-03 via:
//   curl 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein\
//     &id=NP_002736.3&rettype=gp&retmode=xml&tool=jbrowse-plugin-msaview\
//     &email=colin.diesh@gmail.com'
// NP_002736.3 is human MAPK1/ERK2: one CDD kinase domain plus CDD active/other
// sites. Re-record with the command above if NCBI changes the GenPept format;
// the live test below verifies the real endpoint still matches this fixture.
const realXml = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    'fixtures/efetch-NP_002736.3.gp.xml',
  ),
  'utf8',
)

describe('parseCddDomains on a real recorded NCBI GenPept response', () => {
  test('extracts the kinase domain as one contiguous region', () => {
    const matches = parseCddDomains(realXml).get('NP_002736.3')!
    const domain = matches.find(m => m.signature.entry!.accession === '270839')!
    expect(domain.signature.entry!.name).toBe('STKc_ERK1_2_like')
    expect(domain.locations).toEqual([{ start: 19, end: 353 }])
  })

  test('extracts a CDD active site as many discontiguous residues', () => {
    const matches = parseCddDomains(realXml).get('NP_002736.3')!
    const active = matches.find(m => m.signature.entry!.name === 'active')!
    // distinct accession so it gets its own color, not the parent domain's
    expect(active.signature.entry!.accession).toBe('270839:active')
    expect(active.locations.length).toBeGreaterThan(1)
  })

  test('keys by both versioned and primary accession', () => {
    const result = parseCddDomains(realXml)
    expect(result.get('NP_002736')).toEqual(result.get('NP_002736.3'))
  })
})

// Hits the live NCBI endpoint; opt-in via NCBI_LIVE_TESTS=1 so CI stays
// offline/deterministic. Guards that the recorded fixture above hasn't drifted
// from what NCBI actually serves.
const liveTest = process.env.NCBI_LIVE_TESTS ? test : test.skip

describe('efetch against the live NCBI endpoint', () => {
  liveTest(
    'returns CDD domains that parse to the same kinase domain',
    async () => {
      const res = await fetch(
        efetchUrl({
          db: 'protein',
          id: 'NP_002736.3',
          rettype: 'gp',
          retmode: 'xml',
        }),
      )
      const matches = parseCddDomains(await res.text()).get('NP_002736.3')!
      expect(
        matches.some(m => m.signature.entry!.name === 'STKc_ERK1_2_like'),
      ).toBe(true)
    },
    60_000,
  )
})
