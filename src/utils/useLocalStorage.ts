import { useState } from 'react'

// Vendored rather than imported from `@jbrowse/core/util`: that barrel is
// host-provided, and a barrel split dropped this export, making the BLAST panel
// throw "(0, PR.useLocalStorage) is not a function" on hosts built during that
// window. Same failure mode as `defaultCodonTable`; keeping our own copy takes
// this plugin out of the whack-a-mole.
export function readLocalStorage<T>(key: string, initialValue: T): T {
  try {
    const item = globalThis.localStorage.getItem(key)
    return item === null ? initialValue : (JSON.parse(item) as T)
  } catch (error) {
    console.error(error)
    return initialValue
  }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() =>
    readLocalStorage(key, initialValue),
  )
  const setValue = (value: T) => {
    setStoredValue(value)
    try {
      globalThis.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(error)
    }
  }
  return [storedValue, setValue] as const
}
