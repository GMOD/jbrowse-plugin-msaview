import { useLocalStorage } from '../../../utils/useLocalStorage'
import {
  databaseOptionsFor,
  defaultSearchFor,
  msaAlgorithms,
  searchPrograms,
} from './consts'

import type { MsaAlgorithm, SearchChoice } from './consts'

// The panel reopens on the last search run rather than on the defaults, the way
// the Orthologs tab remembers its source.
//
// The program and its database stay ONE stored value for the reason consts.ts
// keeps them one state: neither service knows the other's database names. What
// comes back is checked against the current options before it is used — an
// option this plugin has since dropped would otherwise reach EBI and come back
// a 400, minutes after the user pressed Submit.
export const SEARCH_CHOICE_STORAGE_KEY = 'msaView-blastSearch'
export const MSA_ALGORITHM_STORAGE_KEY = 'msaView-msaAlgorithm'

const defaultSearch = defaultSearchFor('blastp')
const defaultMsaAlgorithm: MsaAlgorithm = 'clustalo'

export function validSearchChoice(stored: unknown): SearchChoice {
  const { program, database } = (stored ?? {}) as {
    program?: string
    database?: string
  }
  const known = searchPrograms.find(p => p === program)
  return known && databaseOptionsFor(known).some(d => d === database)
    ? ({ program: known, database } as SearchChoice)
    : defaultSearch
}

export function validMsaAlgorithm(stored: unknown): MsaAlgorithm {
  return msaAlgorithms.find(a => a === stored) ?? defaultMsaAlgorithm
}

export function useStoredSearchChoice() {
  const [stored, setStored] = useLocalStorage<unknown>(
    SEARCH_CHOICE_STORAGE_KEY,
    defaultSearch,
  )
  return [
    validSearchChoice(stored),
    (choice: SearchChoice) => {
      setStored(choice)
    },
  ] as const
}

export function useStoredMsaAlgorithm() {
  const [stored, setStored] = useLocalStorage<unknown>(
    MSA_ALGORITHM_STORAGE_KEY,
    defaultMsaAlgorithm,
  )
  return [
    validMsaAlgorithm(stored),
    (algorithm: MsaAlgorithm) => {
      setStored(algorithm)
    },
  ] as const
}
