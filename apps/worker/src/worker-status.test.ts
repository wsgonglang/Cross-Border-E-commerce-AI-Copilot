import { describe, expect, it } from 'vitest'

import { createWorkerStatus } from './worker-status'

describe('createWorkerStatus', () => {
  it('identifies the ready worker process', () => {
    expect(createWorkerStatus('catalog-worker')).toEqual({
      status: 'ready',
      service: 'worker',
      workerName: 'catalog-worker',
    })
  })
})
