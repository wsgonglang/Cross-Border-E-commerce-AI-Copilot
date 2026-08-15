import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getAgentRun, getAiResults } from '../api/ai-results'
import { getAiQualityReport } from '../api/ai-quality'
import { listAiSessions } from '../api/ai'
import { getBatchTask, getBatchTasks } from '../api/batch-tasks'
import { getImportJob, listImportJobs } from '../api/imports'
import { getOrders } from '../api/orders'
import {
  queryKeys,
  type AiResultsQueryInput,
  type OrderQueryInput,
} from './query-keys'
import type { AiQualityWindowDays } from '@cross-border/shared'

export function useOrdersQuery(
  token: string,
  merchantId: string,
  input: OrderQueryInput,
) {
  return useQuery({
    queryKey: queryKeys.orders(merchantId, input),
    queryFn: () => getOrders(token, merchantId, input),
    enabled: Boolean(token && merchantId),
    placeholderData: keepPreviousData,
  })
}

export function useBatchTasksQuery(
  token: string,
  merchantId: string,
  page: number,
) {
  return useQuery({
    queryKey: queryKeys.batchTasks(merchantId, page),
    queryFn: () => getBatchTasks(token, merchantId, page, 20),
    enabled: Boolean(token && merchantId),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const tasks = query.state.data?.items ?? []
      return tasks.some(
        (task) => task.status === 'PENDING' || task.status === 'RUNNING',
      )
        ? 2_000
        : false
    },
  })
}

export function useBatchTaskQuery(
  token: string,
  merchantId: string,
  taskId?: string,
) {
  return useQuery({
    queryKey: queryKeys.batchTask(merchantId, taskId ?? ''),
    queryFn: () => getBatchTask(token, merchantId, taskId!),
    enabled: Boolean(token && merchantId && taskId),
    refetchInterval: (query) =>
      query.state.data &&
      ['PENDING', 'RUNNING'].includes(query.state.data.status)
        ? 2_000
        : false,
  })
}

export function useImportJobsQuery(token: string, merchantId: string) {
  return useQuery({
    queryKey: queryKeys.importJobs(merchantId),
    queryFn: () => listImportJobs(token, merchantId),
    enabled: Boolean(token && merchantId),
    refetchInterval: (query) => {
      const jobs = query.state.data?.items ?? []
      return jobs.some((job) => ['PENDING', 'RUNNING'].includes(job.status))
        ? 2_000
        : false
    },
  })
}

export function useImportJobQuery(
  token: string,
  merchantId: string,
  jobId?: string,
) {
  return useQuery({
    queryKey: queryKeys.importJob(merchantId, jobId ?? ''),
    queryFn: () => getImportJob(token, merchantId, jobId!),
    enabled: Boolean(token && merchantId && jobId),
    refetchInterval: (query) =>
      query.state.data &&
      ['PENDING', 'RUNNING'].includes(query.state.data.status)
        ? 2_000
        : false,
  })
}

export function useAiResultsQuery(
  token: string,
  merchantId: string,
  input: AiResultsQueryInput,
) {
  return useQuery({
    queryKey: queryKeys.aiResults(merchantId, input),
    queryFn: () => getAiResults(token, merchantId, input),
    enabled: Boolean(token && merchantId),
    placeholderData: keepPreviousData,
  })
}

export function useRecentAiSessionsQuery(
  token: string,
  merchantId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.aiSessions(merchantId),
    queryFn: () => listAiSessions(token, merchantId),
    enabled: Boolean(enabled && token && merchantId),
    staleTime: 15_000,
    refetchInterval: (query) =>
      query.state.data?.items.some((session) => session.status === 'streaming')
        ? 2_000
        : false,
  })
}

export function useAgentRunQuery(
  token: string,
  merchantId: string,
  runId?: string,
  options?: { poll?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.agentRun(merchantId, runId ?? ''),
    queryFn: () => getAgentRun(token, merchantId, runId!),
    enabled: Boolean(token && merchantId && runId),
    // 轮询模式：运行未终态时持续刷新，实时展示工具轨迹；终态后停止。
    refetchInterval: options?.poll
      ? (query) => agentRunRefetchInterval(query.state.data?.status)
      : false,
  })
}

export function agentRunRefetchInterval(status?: string): false | number {
  return status && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)
    ? false
    : 1200
}

export function useAiQualityQuery(
  token: string,
  merchantId: string,
  days: AiQualityWindowDays,
) {
  return useQuery({
    queryKey: queryKeys.aiQuality(merchantId, days),
    queryFn: () => getAiQualityReport(token, merchantId, days),
    enabled: Boolean(token && merchantId),
    placeholderData: keepPreviousData,
  })
}
