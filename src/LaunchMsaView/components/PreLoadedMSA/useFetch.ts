import { useEffect, useState } from 'react'

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

  useEffect(() => {
    // Don't fetch if key is 'none'
    if (key === 'none') return

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const fetchPromise = fetcher()
        if (fetchPromise) {
          const result = await fetchPromise
          setData(result)
        } else {
          setData(undefined)
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [key, fetcher])

  return { data, isLoading, error }
}
