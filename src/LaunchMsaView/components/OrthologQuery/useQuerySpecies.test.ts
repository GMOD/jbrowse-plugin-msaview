// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import {
  resolveAssemblySpecies,
  resolveTaxId,
} from '../../../utils/ncbiTaxonomy'
import { fetchTaxonomyInfo } from '../../../utils/taxonomyNames'
import { useQuerySpecies } from './QuerySpeciesSelect'

vi.mock('../../../utils/ncbiTaxonomy', () => ({
  resolveAssemblySpecies: vi.fn(),
  resolveTaxId: vi.fn(),
}))
vi.mock('../../../utils/taxonomyNames', () => ({
  fetchTaxonomyInfo: vi.fn(),
}))

const mockAssembly = vi.mocked(resolveAssemblySpecies)
const mockTaxId = vi.mocked(resolveTaxId)
const mockInfo = vi.mocked(fetchTaxonomyInfo)

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('useQuerySpecies', () => {
  test('has no taxon until the assembly lookup answers', async () => {
    const lookup = deferred<{ taxId: number; speciesName: string }>()
    mockAssembly.mockReturnValue(lookup.promise)
    const { result } = renderHook(() => useQuerySpecies('mm39'))
    expect(result.current.taxId).toBeUndefined()
    expect(result.current.resolving).toBe(true)
    await act(async () => {
      lookup.resolve({ taxId: 10090, speciesName: 'Mus musculus' })
      await lookup.promise
    })
    expect(result.current.taxId).toBe(10090)
    expect(result.current.resolving).toBe(false)
  })

  test('falls back to human when the assembly lookup finds nothing', async () => {
    mockAssembly.mockResolvedValue(undefined)
    const { result } = renderHook(() => useQuerySpecies('myAssembly'))
    await waitFor(() => {
      expect(result.current.taxId).toBe(9606)
    })
  })

  test('has no taxon when the assembly lookup fails', async () => {
    mockAssembly.mockRejectedValue(new Error('blocked by CORS policy'))
    const { result } = renderHook(() => useQuerySpecies('mm39'))
    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })
    expect(result.current.taxId).toBeUndefined()
    expect(result.current.resolving).toBe(false)
    expect(result.current.text).toBe('')
  })

  test('falls back to human without an assembly to look up', () => {
    const { result } = renderHook(() => useQuerySpecies(undefined))
    expect(result.current.taxId).toBe(9606)
    expect(mockAssembly).not.toHaveBeenCalled()
  })

  test('has no taxon while typed text debounces and resolves', async () => {
    mockAssembly.mockResolvedValue(undefined)
    mockTaxId.mockResolvedValue(9913)
    mockInfo.mockResolvedValue(new Map([[9913, { sciname: 'Bos taurus' }]]))
    const { result } = renderHook(() => useQuerySpecies('myAssembly'))
    await waitFor(() => {
      expect(result.current.taxId).toBe(9606)
    })
    act(() => {
      result.current.setTyped('cow')
    })
    expect(result.current.taxId).toBeUndefined()
    expect(result.current.resolving).toBe(true)
    await waitFor(() => {
      expect(result.current.taxId).toBe(9913)
    })
    expect(result.current.resolved).toBe('Bos taurus')
  })

  test('has no taxon after a typed lookup fails', async () => {
    mockAssembly.mockResolvedValue(undefined)
    mockTaxId.mockResolvedValue(undefined)
    const { result } = renderHook(() => useQuerySpecies('myAssembly'))
    act(() => {
      result.current.setTyped('cwo')
    })
    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })
    expect(result.current.taxId).toBeUndefined()
    expect(result.current.resolving).toBe(false)
  })
})
