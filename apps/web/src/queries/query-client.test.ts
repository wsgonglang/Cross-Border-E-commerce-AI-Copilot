import { describe, expect, it } from 'vitest'

import { createQueryClient } from './query-client'
import { queryKeys } from './query-keys'

describe('server state query policy', () => {
  it('uses bounded cache and retry defaults', () => {
    const client = createQueryClient()
    const queries = client.getDefaultOptions().queries
    const mutations = client.getDefaultOptions().mutations

    expect(queries?.staleTime).toBe(30_000)
    expect(queries?.gcTime).toBe(300_000)
    expect(queries?.retry).toBe(1)
    expect(queries?.refetchOnWindowFocus).toBe(false)
    expect(mutations?.retry).toBe(false)
  })

  it('isolates merchant, store, filter and detail caches', () => {
    const client = createQueryClient()
    const merchantAProducts = queryKeys.products('merchant-a', {
      page: 1,
      pageSize: 10,
      storeId: 'store-a',
    })
    const merchantBProducts = queryKeys.products('merchant-b', {
      page: 1,
      pageSize: 10,
      storeId: 'store-b',
    })

    client.setQueryData(merchantAProducts, ['product-a'])
    client.setQueryData(merchantBProducts, ['product-b'])
    client.setQueryData(queryKeys.batchTask('merchant-a', 'task-1'), {
      status: 'RUNNING',
    })

    expect(client.getQueryData(merchantAProducts)).toEqual(['product-a'])
    expect(client.getQueryData(merchantBProducts)).toEqual(['product-b'])
    expect(
      client.getQueryData(queryKeys.batchTask('merchant-b', 'task-1')),
    ).toBeUndefined()
  })

  it('invalidates a merchant product family without touching another merchant', async () => {
    const client = createQueryClient()
    const merchantA = queryKeys.products('merchant-a', {
      page: 1,
      pageSize: 10,
    })
    const merchantB = queryKeys.products('merchant-b', {
      page: 1,
      pageSize: 10,
    })
    client.setQueryData(merchantA, [])
    client.setQueryData(merchantB, [])

    await client.invalidateQueries({
      queryKey: queryKeys.productsRoot('merchant-a'),
    })

    expect(client.getQueryState(merchantA)?.isInvalidated).toBe(true)
    expect(client.getQueryState(merchantB)?.isInvalidated).toBe(false)
  })

  it('isolates AI quality reports by merchant and reporting window', () => {
    expect(queryKeys.aiQuality('merchant-a', 30)).not.toEqual(
      queryKeys.aiQuality('merchant-b', 30),
    )
    expect(queryKeys.aiQuality('merchant-a', 7)).not.toEqual(
      queryKeys.aiQuality('merchant-a', 90),
    )
  })
})
