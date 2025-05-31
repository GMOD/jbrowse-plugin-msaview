import { useEffect, useRef, useState } from 'react'

// Cache to store in-flight requests
const fetchingCache = new Map<string, Promise<any>>()

/**
 * Custom hook for data fetching, similar to useSWR but simpler
 * @param key - A unique key for the data fetch, used for cache invalidation
 * @param fetcher - A function that returns a promise with the data
 * @returns Object containing data, loading state, and error state
 */
export function useFetch<T>(
  key: string,
  fetcher: () => Promise<T | undefined> | undefined,
) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  // Use ref to track if a fetch is already in progress for this key
  const inProgressRef = useRef(false)

  useEffect(() => {
    // Don't fetch if key is 'none'
    if (key === 'none') {return}

    // Cleanup function
    let isMounted = true

    const fetchData = async () => {
      // Check if this component already started a fetch for this key
      if (inProgressRef.current) {return}

      // Check if another instance is already fetching this key
      if (fetchingCache.has(key)) {
        setIsLoading(true)
        try {
          // Reuse the existing promise
          const result = await fetchingCache.get(key)
          if (isMounted) {
            setData(result)
          }
        } catch (err) {
          if (isMounted) {
            setError(err instanceof Error ? err : new Error(String(err)))
          }
        } finally {
          if (isMounted) {
            setIsLoading(false)
          }
        }
        return
      }

      // Mark that we're starting a fetch
      inProgressRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const fetchPromise = fetcher()
        if (fetchPromise) {
          // Store the promise in the cache
          fetchingCache.set(key, fetchPromise)

          const result = await fetchPromise
          // Remove from cache after completion
          fetchingCache.delete(key)

          if (isMounted) {
            setData(result)
          }
        } else {
          if (isMounted) {
            setData(undefined)
          }
        }
      } catch (err) {
        // Remove from cache on error
        fetchingCache.delete(key)

        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
        inProgressRef.current = false
      }
    }

    fetchData()

    // Cleanup function
    return () => {
      isMounted = false
    }
  }, [key, fetcher])

  return { data, isLoading, error }
}
