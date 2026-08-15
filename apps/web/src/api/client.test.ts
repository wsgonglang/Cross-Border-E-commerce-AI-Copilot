import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiRequest, configureApiAuthRecovery } from './client'

afterEach(() => {
  configureApiAuthRecovery(null)
  vi.restoreAllMocks()
})

describe('apiRequest auth recovery', () => {
  it('shares one refresh across concurrent 401 responses and replays both requests', async () => {
    let resolveRefresh: ((token: string) => void) | undefined
    const refreshAccessToken = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve
        }),
    )
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'first' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'second' }), { status: 200 }),
      )

    configureApiAuthRecovery({
      refreshAccessToken,
      onSessionExpired: vi.fn(),
    })

    const first = apiRequest<{ id: string }>('expired', '/api/first')
    const second = apiRequest<{ id: string }>('expired', '/api/second')
    await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce())
    resolveRefresh?.('fresh')

    await expect(Promise.all([first, second])).resolves.toEqual([
      { id: 'first' },
      { id: 'second' },
    ])
    expect(refreshAccessToken).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/first')
    expect(
      new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer fresh')
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/second')
    expect(
      new Headers(fetchMock.mock.calls[3]?.[1]?.headers).get('Authorization'),
    ).toBe('Bearer fresh')
  })

  it('expires the local session when refresh fails without retrying forever', async () => {
    const onSessionExpired = vi.fn()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    configureApiAuthRecovery({
      refreshAccessToken: vi
        .fn()
        .mockRejectedValue(new Error('refresh failed')),
      onSessionExpired,
    })

    await expect(apiRequest('expired', '/api/products')).rejects.toThrow(
      'refresh failed',
    )
    expect(onSessionExpired).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not refresh non-401 failures and replays a request at most once', async () => {
    const refreshAccessToken = vi.fn().mockResolvedValue('fresh')
    const onSessionExpired = vi.fn()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 }),
      )

    configureApiAuthRecovery({ refreshAccessToken, onSessionExpired })
    await expect(apiRequest('token', '/api/forbidden')).rejects.toThrow(
      'forbidden',
    )
    expect(refreshAccessToken).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledOnce()

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'still unauthorized' }), {
          status: 401,
        }),
      )
    await expect(apiRequest('expired', '/api/protected')).rejects.toThrow(
      'still unauthorized',
    )
    expect(refreshAccessToken).toHaveBeenCalledOnce()
    expect(onSessionExpired).toHaveBeenCalledOnce()
  })
})
