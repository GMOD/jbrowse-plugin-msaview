import { openDB } from 'idb'

import type { DBSchema, IDBPDatabase, OpenDBCallbacks } from 'idb'

/**
 * Memoized `openDB` for a typed schema, shared by this plugin's caches.
 *
 * The connection promise is cached so callers share one connection, and dropped
 * again if the open fails, so a later call retries instead of replaying the same
 * rejection forever (IndexedDB is unavailable in some private-browsing modes).
 *
 * Passing a DBSchema is what keeps `get`/`getAll` from returning `any`: with an
 * untyped database every cached record reaches the UI unchecked.
 */
export function createDbOpener<T extends DBSchema>(
  name: string,
  version: number,
  upgrade: OpenDBCallbacks<T>['upgrade'],
) {
  let dbPromise: Promise<IDBPDatabase<T>> | undefined
  return () => {
    dbPromise ??= openDB<T>(name, version, { upgrade }).catch((e: unknown) => {
      dbPromise = undefined
      throw e
    })
    return dbPromise
  }
}
