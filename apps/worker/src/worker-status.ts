export interface WorkerStatus {
  status: 'ready'
  service: 'worker'
  workerName: string
}

export function createWorkerStatus(workerName: string): WorkerStatus {
  return {
    status: 'ready',
    service: 'worker',
    workerName,
  }
}
