import { SimpleFeature } from '@jbrowse/core/util'
import {
  getGeneticCode,
  parseTranslTable,
} from '@jbrowse/core/util/geneticCodes'
import { describe, expect, it } from 'vitest'

import {
  calculateProteinSequence,
  getProteinSequenceFromFeature,
} from '../src/LaunchMsaView/components/calculateProteinSequence'

// The table @jbrowse/core/util exported as `defaultCodonTable` up to 4.3.0,
// pinned here so core's NCBI strings can't drift from what every released host
// translates with. The module is a deep path and therefore bundled, so the
// version this build pins is the one every host runs.
const RELEASED_DEFAULT_CODON_TABLE: Record<string, string> = {
  TCA: 'S',
  TCC: 'S',
  TCG: 'S',
  TCT: 'S',
  TTC: 'F',
  TTT: 'F',
  TTA: 'L',
  TTG: 'L',
  TAC: 'Y',
  TAT: 'Y',
  TAA: '*',
  TAG: '*',
  TGC: 'C',
  TGT: 'C',
  TGA: '*',
  TGG: 'W',
  CTA: 'L',
  CTC: 'L',
  CTG: 'L',
  CTT: 'L',
  CCA: 'P',
  CCC: 'P',
  CCG: 'P',
  CCT: 'P',
  CAC: 'H',
  CAT: 'H',
  CAA: 'Q',
  CAG: 'Q',
  CGA: 'R',
  CGC: 'R',
  CGG: 'R',
  CGT: 'R',
  ATA: 'I',
  ATC: 'I',
  ATT: 'I',
  ATG: 'M',
  ACA: 'T',
  ACC: 'T',
  ACG: 'T',
  ACT: 'T',
  AAC: 'N',
  AAT: 'N',
  AAA: 'K',
  AAG: 'K',
  AGC: 'S',
  AGT: 'S',
  AGA: 'R',
  AGG: 'R',
  GTA: 'V',
  GTC: 'V',
  GTG: 'V',
  GTT: 'V',
  GCA: 'A',
  GCC: 'A',
  GCG: 'A',
  GCT: 'A',
  GAC: 'D',
  GAT: 'D',
  GAA: 'E',
  GAG: 'E',
  GGA: 'G',
  GGC: 'G',
  GGG: 'G',
  GGT: 'G',
}

describe('genetic codes', () => {
  it('table 1 matches the codon table released hosts ship', () => {
    const { codonTable } = getGeneticCode(1)
    for (const [codon, aa] of Object.entries(RELEASED_DEFAULT_CODON_TABLE)) {
      expect(codonTable[codon]).toBe(aa)
    }
    expect(Object.keys(RELEASED_DEFAULT_CODON_TABLE)).toHaveLength(64)
  })

  it('resolves every case combination of a codon', () => {
    const { codonTable } = getGeneticCode()
    expect(codonTable.atg).toBe('M')
    expect(codonTable.aTg).toBe('M')
    expect(codonTable.ATG).toBe('M')
  })

  it('vertebrate mitochondrial (2) reassigns TGA, ATA and AGA', () => {
    const { codonTable, starts } = getGeneticCode(2)
    expect(codonTable.TGA).toBe('W')
    expect(codonTable.ATA).toBe('M')
    expect(codonTable.AGA).toBe('*')
    expect(codonTable.AGG).toBe('*')
    expect(starts).toEqual(['ATT', 'ATC', 'ATA', 'ATG', 'GTG'])
    expect(getGeneticCode(1).codonTable.TGA).toBe('*')
    expect(getGeneticCode(1).codonTable.ATA).toBe('I')
  })

  // Table 11 translates identically to the standard code; its alternative
  // initiators are the only thing that distinguishes it, so `starts` is where a
  // table difference would show.
  it('bacterial (11) shares table 1 codons but adds start codons', () => {
    const { codonTable, starts } = getGeneticCode(11)
    expect(codonTable).toEqual(getGeneticCode(1).codonTable)
    expect(starts).toEqual(['TTG', 'CTG', 'ATT', 'ATC', 'ATA', 'ATG', 'GTG'])
    expect(getGeneticCode(1).starts).toEqual(['TTG', 'CTG', 'ATG'])
  })

  it('falls back to the standard code for an unknown table', () => {
    expect(getGeneticCode(999).codonTable.TGA).toBe('*')
  })

  it('parses transl_table attribute shapes the GFF adapter yields', () => {
    expect(parseTranslTable('2')).toBe(2)
    expect(parseTranslTable(['2'])).toBe(2)
    expect(parseTranslTable(undefined)).toBeUndefined()
    expect(parseTranslTable('not-a-number')).toBeUndefined()
  })
})

describe('calculateProteinSequence', () => {
  const sequence = 'ATGGCTTGATAA'

  it('translates a single stitched CDS', () => {
    expect(
      calculateProteinSequence({
        cds: [{ start: 0, end: 12, type: 'CDS' }],
        sequence,
      }),
    ).toBe('MA**')
  })

  it('stitches multiple CDS segments before translating', () => {
    expect(
      calculateProteinSequence({
        cds: [
          { start: 0, end: 3, type: 'CDS' },
          { start: 6, end: 12, type: 'CDS' },
        ],
        sequence,
      }),
    ).toBe('M**')
  })

  it('honors the genetic code, so table 2 reads TGA as W', () => {
    const cds = [{ start: 0, end: 12, type: 'CDS' }]
    expect(calculateProteinSequence({ cds, sequence, geneticCodeId: 2 })).toBe(
      'MAW*',
    )
    expect(calculateProteinSequence({ cds, sequence })).toBe('MA**')
  })

  it('reads ATA as M under table 2 and I under table 1', () => {
    const cds = [{ start: 0, end: 9, type: 'CDS' }]
    const ata = 'ATGATATGA'
    expect(
      calculateProteinSequence({ cds, sequence: ata, geneticCodeId: 2 }),
    ).toBe('MMW')
    expect(calculateProteinSequence({ cds, sequence: ata })).toBe('MI*')
  })

  it('offsets by the phase of the first CDS', () => {
    // phase 1 skips one base and marks the partial leading codon with '&'
    expect(
      calculateProteinSequence({
        cds: [{ start: 0, end: 12, type: 'CDS', phase: 1 }],
        sequence,
      }),
    ).toBe('&WLD&')
  })

  it('marks an unknown or partial codon with &', () => {
    expect(
      calculateProteinSequence({
        cds: [{ start: 0, end: 5, type: 'CDS' }],
        sequence,
      }),
    ).toBe('M&')
  })
})

describe('getProteinSequenceFromFeature', () => {
  const sequence = 'ATGGCTTGATAA'

  function transcript(attrs: Record<string, unknown> = {}) {
    return new SimpleFeature({
      uniqueId: 'mt-co1',
      refName: 'chrM',
      start: 0,
      end: 12,
      type: 'mRNA',
      strand: 1,
      subfeatures: [
        { uniqueId: 'cds1', refName: 'chrM', start: 0, end: 12, type: 'CDS' },
      ],
      ...attrs,
    })
  }

  // GENCODE and UCSC declare no transl_table at all, so a chrM gene read with
  // the standard code stops at the first TGA
  it('falls back to the assembly code for a contig that declares none', () => {
    expect(
      getProteinSequenceFromFeature({
        seq: sequence,
        feature: transcript(),
        assemblyGeneticCodeId: 2,
      }),
    ).toBe('MAW*')
    expect(
      getProteinSequenceFromFeature({ seq: sequence, feature: transcript() }),
    ).toBe('MA**')
  })

  it("prefers the feature's own transl_table over the assembly's", () => {
    expect(
      getProteinSequenceFromFeature({
        seq: sequence,
        feature: transcript({ transl_table: '1' }),
        assemblyGeneticCodeId: 2,
      }),
    ).toBe('MA**')
  })

  // the CDS records of a transcript can repeat, and a duplicate stitched in
  // twice shifts the frame for everything after it
  it('drops a repeated CDS record', () => {
    const feature = new SimpleFeature({
      uniqueId: 'dup',
      refName: 'chr1',
      start: 0,
      end: 12,
      type: 'mRNA',
      strand: 1,
      subfeatures: [
        { uniqueId: 'a', refName: 'chr1', start: 0, end: 6, type: 'CDS' },
        { uniqueId: 'b', refName: 'chr1', start: 0, end: 6, type: 'CDS' },
        { uniqueId: 'c', refName: 'chr1', start: 6, end: 12, type: 'CDS' },
      ],
    })
    expect(getProteinSequenceFromFeature({ seq: sequence, feature })).toBe(
      'MA**',
    )
  })
})

describe('initiators and transl_except', () => {
  it('reads an alternative initiator as M, as core does', () => {
    const cds = [{ start: 0, end: 9, type: 'CDS' }]
    expect(calculateProteinSequence({ cds, sequence: 'CTGCTGTAA' })).toBe('ML*')
    expect(
      calculateProteinSequence({
        cds,
        sequence: 'GTGGTGTAA',
        geneticCodeId: 11,
      }),
    ).toBe('MV*')
  })

  it('leaves the codon after a partial first codon alone', () => {
    expect(
      calculateProteinSequence({
        cds: [{ start: 0, end: 10, type: 'CDS', phase: 1 }],
        sequence: 'GCTGCTGTAA',
      }),
    ).toBe('&LL*')
  })

  function selenoprotein(strand: 1 | -1, pos: string) {
    return new SimpleFeature({
      uniqueId: 'sel',
      refName: 'chr1',
      start: 100,
      end: 112,
      type: 'mRNA',
      strand,
      subfeatures: [
        {
          uniqueId: 'sel-cds',
          refName: 'chr1',
          start: 100,
          end: 112,
          type: 'CDS',
          transl_except: `(pos:${pos},aa:Sec)`,
        },
      ],
    })
  }

  // read as a stop, a selenocysteine truncates the protein and, once the stop
  // is cleaned out, shifts every residue after it
  it('translates a RefSeq selenocysteine on the forward strand', () => {
    expect(
      getProteinSequenceFromFeature({
        seq: 'ATGGCTTGATAA',
        feature: selenoprotein(1, '107..109'),
      }),
    ).toBe('MAU*')
  })

  it('translates a RefSeq selenocysteine on the reverse strand', () => {
    expect(
      getProteinSequenceFromFeature({
        seq: 'TTATCAAGCCAT',
        feature: selenoprotein(-1, 'complement(104..106)'),
      }),
    ).toBe('MAU*')
  })
})
