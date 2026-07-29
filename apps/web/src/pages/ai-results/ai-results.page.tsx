import type {
  AgentRunSummary,
  AiResultItem,
  AiResultType,
  MerchantSummary,
} from '@cross-border/shared'
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
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getAgentRun, getAiResults } from '../../api/ai-results'
import { getMerchants } from '../../api/commerce'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

const typeLabels: Record<AiResultItem['type'], string> = {
  AGENT_RUN: 'Agent 运行',
  PRODUCT_OPTIMIZATION: '商品优化草稿',
  IMPORT_JOB: '结构化导入',
}

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
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const navigate = useNavigate()
  const [merchants, setMerchants] = useState<MerchantSummary[]>([])
  const [merchantId, setMerchantId] = useState<string>()
  const [type, setType] = useState<AiResultType>()
  const [status, setStatus] = useState<string>()
  const [items, setItems] = useState<AiResultItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [agentRun, setAgentRun] = useState<AgentRunSummary>()

  useEffect(() => {
    if (!token) return
    void getMerchants(token)
      .then((result) => {
        setMerchants(result)
        setMerchantId((current) => current ?? result[0]?.id)
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error ? loadError.message : '商家加载失败',
        ),
      )
  }, [token])

  const load = useCallback(async () => {
    if (!token || !merchantId) return
    setLoading(true)
    try {
      const result = await getAiResults(token, merchantId, {
        page,
        pageSize: 20,
        type,
        status,
      })
      setItems(result.items)
      setTotal(result.total)
      setError(undefined)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : '成果加载失败')
    } finally {
      setLoading(false)
    }
  }, [merchantId, page, status, token, type])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openAgentRun = async (runId: string) => {
    if (!merchantId) return
    try {
      setAgentRun(await getAgentRun(token, merchantId, runId))
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error ? loadError.message : '运行记录加载失败',
      )
    }
  }

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
          <span className="page-kicker">AI result operations</span>
          <h1>AI 成果中心</h1>
          <p>
            统一查看 Agent
            运行、商品优化草稿和批量来源，并进入准确业务对象继续处理。
          </p>
        </div>
      </header>

      <div className="catalog-toolbar">
        <Select
          value={merchantId}
          placeholder="选择商家"
          options={merchants.map((merchant) => ({
            value: merchant.id,
            label: `${merchant.name} · ${merchant.code}`,
          }))}
          onChange={(value) => {
            setMerchantId(value)
            setPage(1)
          }}
        />
        <Select
          allowClear
          value={type}
          placeholder="全部成果类型"
          options={[
            { value: 'AGENT_RUN', label: 'Agent 运行' },
            { value: 'PRODUCT_OPTIMIZATION', label: '商品优化草稿' },
            { value: 'IMPORT_JOB', label: '结构化导入' },
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
          placeholder="全部状态"
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
          ].map((value) => ({ value, label: value }))}
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
              title: '类型',
              dataIndex: 'type',
              width: 145,
              render: (value: AiResultItem['type']) => typeLabels[value],
            },
            {
              title: '成果',
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
              title: '状态',
              dataIndex: 'status',
              width: 120,
              render: (value: string) => (
                <Tag color={statusColors[value] ?? 'default'}>{value}</Tag>
              ),
            },
            {
              title: '来源',
              width: 150,
              render: (_, item) =>
                item.batchTaskId
                  ? '批量任务'
                  : item.type === 'AGENT_RUN'
                    ? '业务 Agent'
                    : item.type === 'IMPORT_JOB'
                      ? '导入中心'
                      : '单商品',
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) =>
                new Date(value).toLocaleString('zh-CN'),
            },
            {
              title: '操作',
              width: 190,
              render: (_, item) => (
                <Space>
                  {item.agentRunId ? (
                    <Button
                      type="link"
                      onClick={() => void openAgentRun(item.agentRunId!)}
                    >
                      查看轨迹
                    </Button>
                  ) : null}
                  {item.optimizationId ? (
                    <Button type="link" onClick={() => openOptimization(item)}>
                      审核草稿
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
                      批次
                    </Button>
                  ) : null}
                  {item.importJobId ? (
                    <Button
                      type="link"
                      onClick={() =>
                        void navigate(`/imports?jobId=${item.importJobId}`)
                      }
                    >
                      导入详情
                    </Button>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Drawer
        title="Agent 运行详情"
        width={760}
        open={Boolean(agentRun)}
        onClose={() => setAgentRun(undefined)}
      >
        {agentRun ? (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[agentRun.status]}>
                  {agentRun.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Token">
                {agentRun.usage.totalTokens}
              </Descriptions.Item>
              <Descriptions.Item label="输入" span={2}>
                {agentRun.message}
              </Descriptions.Item>
              <Descriptions.Item label="回答" span={2}>
                {agentRun.answer || agentRun.error}
              </Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} className="ai-result-trace-title">
              工具执行轨迹
            </Typography.Title>
            <Timeline
              items={agentRun.toolCalls.map((call) => ({
                color: call.status === 'success' ? 'green' : 'red',
                children: (
                  <div>
                    <Space>
                      <Typography.Text strong>{call.name}</Typography.Text>
                      <Tag>{call.status}</Tag>
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
