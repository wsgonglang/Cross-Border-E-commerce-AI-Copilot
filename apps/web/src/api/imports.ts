import type {
  ImportFileAnalysis,
  ImportJobDetail,
  ImportMapping,
  ImportMode,
  ImportPreview,
  PaginatedImportJobs,
} from '@cross-border/shared'

import { apiRequest, getApiError } from './client'

async function uploadRequest<T>(
  token: string,
  path: string,
  file: File,
  fields: Record<string, string>,
): Promise<T> {
  const body = new FormData()
  body.append('file', file)
  Object.entries(fields).forEach(([key, value]) => body.append(key, value))
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  if (!response.ok) throw new Error(await getApiError(response))
  return (await response.json()) as T
}

export function analyzeImportFile(
  token: string,
  merchantId: string,
  file: File,
  headerRow: number,
): Promise<ImportFileAnalysis> {
  return uploadRequest(
    token,
    `/api/merchants/${merchantId}/imports/analyze`,
    file,
    { headerRow: String(headerRow) },
  )
}

export function previewImport(
  token: string,
  merchantId: string,
  file: File,
  input: { worksheet?: string; headerRow: number; mapping: ImportMapping },
): Promise<ImportPreview> {
  return uploadRequest(
    token,
    `/api/merchants/${merchantId}/imports/preview`,
    file,
    {
      worksheet: input.worksheet ?? '',
      headerRow: String(input.headerRow),
      mapping: JSON.stringify(input.mapping),
    },
  )
}

export function createImportJob(
  token: string,
  merchantId: string,
  file: File,
  input: {
    worksheet?: string
    headerRow: number
    mapping: ImportMapping
    mode: ImportMode
    targetLanguage?: string
    idempotencyKey: string
  },
): Promise<ImportJobDetail> {
  return uploadRequest(
    token,
    `/api/merchants/${merchantId}/imports/jobs`,
    file,
    {
      worksheet: input.worksheet ?? '',
      headerRow: String(input.headerRow),
      mapping: JSON.stringify(input.mapping),
      mode: input.mode,
      targetLanguage: input.targetLanguage ?? '',
      idempotencyKey: input.idempotencyKey,
    },
  )
}

export function listImportJobs(
  token: string,
  merchantId: string,
): Promise<PaginatedImportJobs> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/imports/jobs?page=1&pageSize=50`,
  )
}

export function getImportJob(
  token: string,
  merchantId: string,
  jobId: string,
): Promise<ImportJobDetail> {
  return apiRequest(token, `/api/merchants/${merchantId}/imports/jobs/${jobId}`)
}

export function cancelImportJob(
  token: string,
  merchantId: string,
  jobId: string,
): Promise<ImportJobDetail> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/imports/jobs/${jobId}/cancel`,
    { method: 'POST' },
  )
}

export async function downloadImportFailures(
  token: string,
  merchantId: string,
  jobId: string,
): Promise<void> {
  const response = await fetch(
    `/api/merchants/${merchantId}/imports/jobs/${jobId}/failures.csv`,
    { credentials: 'include', headers: { Authorization: `Bearer ${token}` } },
  )
  if (!response.ok) throw new Error(await getApiError(response))
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `import-${jobId}-failures.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
