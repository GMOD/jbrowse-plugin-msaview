import { openDB } from 'idb'

import type { DBSchema, IDBPDatabase, OpenDBCallbacks } from 'idb'

/**
 * Memoized `openDB` for a typed schema, shared by this plugin's caches.
 *
 * Callers share one connection. The opener forgets it whenever it stops being
 * usable, so the next call opens a fresh one instead of replaying a rejection
 * or waiting on a dead handle: when the open fails (IndexedDB is unavailable in
 * some private-browsing modes), when another tab is blocked upgrading the
 * database and this connection steps aside for it, and when the browser
 * terminates the connection.
 *
 * An open blocked by another tab's older connection rejects rather than waiting
 * for that tab to close, which may never happen, since a build that predates
 * `blocking` never steps aside.
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
  const forget = () => {
    dbPromise = undefined
  }
  return () => {
    dbPromise ??= new Promise<IDBPDatabase<T>>((resolve, reject) => {
      let gaveUp = false
      openDB<T>(name, version, {
        upgrade,
        blocked(currentVersion) {
          gaveUp = true
          reject(
            new Error(
              `${name} is held open at version ${currentVersion} by another tab`,
            ),
          )
        },
        blocking(_currentVersion, _blockedVersion, event) {
          ;(event.target as IDBDatabase).close()
          forget()
        },
        terminated: forget,
      }).then(db => {
        if (gaveUp) {
          db.close()
        } else {
          resolve(db)
        }
      }, reject)
    }).catch((e: unknown) => {
      forget()
      throw e
    })
    return dbPromise
  }
}

/**
 * Run a cache operation that the caller can do without. A cache only saves
 * work, so a read that fails answers `fallback` (a miss) and a write that fails
 * is skipped: neither may cost the user a search that already finished.
 */
export async function bestEffort<R>(
  what: string,
  operation: () => Promise<R>,
  fallback: R,
) {
  try {
    return await operation()
  } catch (e) {
    console.warn(`[msaview] ${what} failed, continuing without it:`, e)
    return fallback
  }
}
