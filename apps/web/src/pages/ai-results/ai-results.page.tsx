import type { AiResultItem, AiResultType } from '@cross-border/shared'
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useMerchantsQuery } from '../../queries/commerce.queries'
import {
  useAgentRunQuery,
  useAiResultsQuery,
} from '../../queries/operations.queries'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

const statusColors: Record<string, string> = {
  COMPLETED: 'green',
  DRAFT: 'blue',
  APPLIED: 'green',
  REJECTED: 'default',
  FAILED: 'red',
  ERROR: 'red',
  PLANNING: 'gold',
  RUNNING: 'processing',
  GENERATING: 'processing',
}

export function AiResultsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN'
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const navigate = useNavigate()
  const [selectedMerchantId, setSelectedMerchantId] = useState('')
  const [type, setType] = useState<AiResultType>()
  const [status, setStatus] = useState<string>()
  const [page, setPage] = useState(1)
  const [agentRunId, setAgentRunId] = useState<string>()
  const merchantsQuery = useMerchantsQuery(token)
  const merchants = merchantsQuery.data ?? []
  const merchantId =
    merchants.find((merchant) => merchant.id === selectedMerchantId)?.id ??
    merchants[0]?.id ??
    ''
  const resultsQuery = useAiResultsQuery(token, merchantId, {
    page,
    pageSize: 20,
    type,
    status,
  })
  const agentRunQuery = useAgentRunQuery(token, merchantId, agentRunId)
  const items = resultsQuery.data?.items ?? []
  const total = resultsQuery.data?.total ?? 0
  const loading = resultsQuery.isFetching
  const agentRun = agentRunQuery.data
  const queryError =
    merchantsQuery.error ?? resultsQuery.error ?? agentRunQuery.error
  const error = queryError instanceof Error ? queryError.message : undefined

  const openOptimization = (item: AiResultItem) => {
    if (!merchantId || !item.product || !item.optimizationId) return
    const params = new URLSearchParams({
      merchantId,
      productId: item.product.id,
      optimizationId: item.optimizationId,
      keyword: item.product.code,
    })
    void navigate(`/products?${params.toString()}`)
  }

  return (
    <main className="workspace-page ai-results-page">
      <header className="workspace-header">
        <div>
          <span className="page-kicker">{t('aiResults.kicker')}</span>
          <h1>{t('aiResults.title')}</h1>
          <p>{t('aiResults.description')}</p>
        </div>
      </header>

      <div className="catalog-toolbar">
        <Select
          value={merchantId}
          placeholder={t('aiResults.selectMerchant')}
          options={merchants.map((merchant) => ({
            value: merchant.id,
            label: `${merchant.name} · ${merchant.code}`,
          }))}
          onChange={(value) => {
            setSelectedMerchantId(value)
            setPage(1)
            setAgentRunId(undefined)
          }}
        />
        <Select
          allowClear
          value={type}
          placeholder={t('aiResults.allTypes')}
          options={[
            { value: 'AGENT_RUN', label: t('aiResults.types.AGENT_RUN') },
            {
              value: 'PRODUCT_OPTIMIZATION',
              label: t('aiResults.types.PRODUCT_OPTIMIZATION'),
            },
            { value: 'IMPORT_JOB', label: t('aiResults.types.IMPORT_JOB') },
          ]}
          onChange={(value: AiResultType | undefined) => {
            setType(value)
            setStatus(undefined)
            setPage(1)
          }}
        />
        <Select
          allowClear
          value={status}
          placeholder={t('aiResults.allStatuses')}
          options={[
            'PLANNING',
            'RUNNING',
            'COMPLETED',
            'FAILED',
            'GENERATING',
            'DRAFT',
            'APPLIED',
            'REJECTED',
            'ERROR',
            'PENDING',
            'PARTIAL_FAILED',
            'CANCELLED',
          ].map((value) => ({
            value,
            label: t(`aiResults.statuses.${value}`, { defaultValue: value }),
          }))}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        />
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <div className="table-card">
        <Table<AiResultItem>
          rowKey="id"
          loading={loading}
          dataSource={items}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            {
              title: t('aiResults.type'),
              dataIndex: 'type',
              width: 145,
              render: (value: AiResultItem['type']) =>
                t(`aiResults.types.${value}`),
            },
            {
              title: t('aiResults.result'),
              render: (_, item) => (
                <div>
                  <Typography.Text strong>{item.title}</Typography.Text>
                  <Typography.Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    className="ai-result-description"
                  >
                    {item.description}
                  </Typography.Paragraph>
                </div>
              ),
            },
            {
              title: t('common.status'),
              dataIndex: 'status',
              width: 120,
              render: (value: string) => (
                <Tag color={statusColors[value] ?? 'default'}>
                  {t(`aiResults.statuses.${value}`, { defaultValue: value })}
                </Tag>
              ),
            },
            {
              title: t('aiResults.source'),
              width: 150,
              render: (_, item) =>
                item.batchTaskId
                  ? t('aiResults.sources.batch')
                  : item.type === 'AGENT_RUN'
                    ? t('aiResults.sources.agent')
                    : item.type === 'IMPORT_JOB'
                      ? t('aiResults.sources.import')
                      : t('aiResults.sources.product'),
            },
            {
              title: t('aiResults.createdAt'),
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(locale),
            },
            {
              title: t('common.actions'),
              width: 190,
              render: (_, item) => (
                <Space>
                  {item.agentRunId ? (
                    <Button
                      type="link"
                      onClick={() => setAgentRunId(item.agentRunId)}
                    >
                      {t('aiResults.trace')}
                    </Button>
                  ) : null}
                  {item.optimizationId ? (
                    <Button type="link" onClick={() => openOptimization(item)}>
                      {t('aiResults.review')}
                    </Button>
                  ) : null}
                  {item.batchTaskId ? (
                    <Button
                      type="link"
                      onClick={() =>
                        void navigate(
                          `/batch-tasks?merchantId=${merchantId}&taskId=${item.batchTaskId}`,
                        )
                      }
                    >
                      {t('aiResults.batch')}
                    </Button>
                  ) : null}
                  {item.importJobId ? (
                    <Button
                      type="link"
                      onClick={() =>
                        void navigate(`/imports?jobId=${item.importJobId}`)
                      }
                    >
                      {t('aiResults.importDetails')}
                    </Button>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Drawer
        title={t('aiResults.runDetails')}
        width={760}
        open={Boolean(agentRun)}
        onClose={() => setAgentRunId(undefined)}
      >
        {agentRun ? (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label={t('common.status')}>
                <Tag color={statusColors[agentRun.status]}>
                  {t(`aiResults.statuses.${agentRun.status}`, {
                    defaultValue: agentRun.status,
                  })}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('aiResults.token')}>
                {agentRun.usage.totalTokens}
              </Descriptions.Item>
              <Descriptions.Item label={t('aiResults.input')} span={2}>
                {agentRun.message}
              </Descriptions.Item>
              <Descriptions.Item label={t('aiResults.answer')} span={2}>
                {agentRun.answer || agentRun.error}
              </Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} className="ai-result-trace-title">
              {t('aiResults.toolTrace')}
            </Typography.Title>
            <Timeline
              items={agentRun.toolCalls.map((call) => ({
                color: call.status === 'success' ? 'green' : 'red',
                children: (
                  <div>
                    <Space>
                      <Typography.Text strong>{call.name}</Typography.Text>
                      <Tag>
                        {t(`aiResults.toolStatuses.${call.status}`, {
                          defaultValue: call.status,
                        })}
                      </Tag>
                    </Space>
                    <pre className="agent-tool-result">
                      {JSON.stringify(call.output ?? call.error, null, 2)}
                    </pre>
                  </div>
                ),
              }))}
            />
          </>
        ) : null}
      </Drawer>
    </main>
  )
}
