import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getAgentRun, getAiResults } from '../api/ai-results'
import { getBatchTask, getBatchTasks } from '../api/batch-tasks'
import { getImportJob, listImportJobs } from '../api/imports'
import { getOrders } from '../api/orders'
import {
  queryKeys,
  type AiResultsQueryInput,
  type OrderQueryInput,
} from './query-keys'

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

export function useAgentRunQuery(
  token: string,
  merchantId: string,
  runId?: string,
) {
  return useQuery({
    queryKey: queryKeys.agentRun(merchantId, runId ?? ''),
    queryFn: () => getAgentRun(token, merchantId, runId!),
    enabled: Boolean(token && merchantId && runId),
  })
}
