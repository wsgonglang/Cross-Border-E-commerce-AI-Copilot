import 'dotenv/config'

import { loadWorkerEnvironment } from '@cross-border/shared'
import { startBatchWorker } from '@cross-border/api/batch-worker'

import { createWorkerStatus } from './worker-status'

const environment = loadWorkerEnvironment(process.env)
const status = createWorkerStatus(environment.WORKER_NAME)

void startBatchWorker(environment.WORKER_NAME)
  .then(() => {
    process.stdout.write(`${JSON.stringify(status)}\n`)
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[worker-startup] ${message}\n`)
    process.exitCode = 1
  })
