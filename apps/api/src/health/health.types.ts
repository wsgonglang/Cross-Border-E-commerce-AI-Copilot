export interface LivenessStatus {
  status: 'ok'
  service: 'api'
  timestamp: string
}

export interface DependencyStatus {
  status: 'up' | 'down'
  latencyMs: number
}

export interface ReadinessStatus {
  status: 'ready' | 'not_ready'
  service: 'api'
  timestamp: string
  dependencies: {
    mysql: DependencyStatus
    redis: DependencyStatus
  }
}
