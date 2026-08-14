import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  LikeOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type {
  AiQualityDailyPoint,
  AiQualityRateMetric,
  AiQualityTrace,
  AiQualityWindowDays,
} from '@cross-border/shared'
import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Progress,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useBusinessContext } from '../../contexts/business-context'
import { formatDate, formatDateTime } from '../../i18n/formatters'
import type { AppLanguage } from '../../i18n/i18n'
import {
  useAgentRunQuery,
  useAiQualityQuery,
} from '../../queries/operations.queries'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

const statusColors: Record<string, string> = {
  APPLIED: 'green',
  COMPLETED: 'green',
  DRAFT: 'blue',
  ERROR: 'red',
  FAILED: 'red',
  GENERATING: 'processing',
  PLANNING: 'gold',
  REJECTED: 'default',
  RUNNING: 'processing',
}

function percentage(metric: AiQualityRateMetric): number | null {
  return metric.rate === null ? null : Math.round(metric.rate * 1000) / 10
}

function MetricCard({
  accent,
  detail,
  icon,
  label,
  value,
}: {
  accent?: 'danger' | 'success'
  detail: ReactNode
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <Card className={`ai-quality-metric ${accent ?? ''}`} size="small">
      <div className="ai-quality-metric-heading">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <div className="ai-quality-metric-detail">{detail}</div>
    </Card>
  )
}

export function AiQualityPage() {
  const { t, i18n } = useTranslation()
  const language: AppLanguage =
    i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN'
  const navigate = useNavigate()
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const { merchantId, currentMerchant } = useBusinessContext()
  const [days, setDays] = useState<AiQualityWindowDays>(30)
  const [selectedRunId, setSelectedRunId] = useState<string>()
  const qualityQuery = useAiQualityQuery(token, merchantId, days)
  const runQuery = useAgentRunQuery(token, merchantId, selectedRunId)
  const report = qualityQuery.data
  const queryError = qualityQuery.error ?? runQuery.error
  const error = queryError instanceof Error ? queryError.message : undefined
  const number = new Intl.NumberFormat(language)

  const formatRate = (metric: AiQualityRateMetric) => {
    const value = percentage(metric)
    return value === null ? '—' : `${value.toFixed(1)}%`
  }
  const formatDuration = (milliseconds: number | null | undefined) => {
    if (milliseconds === null || milliseconds === undefined) return '—'
    if (milliseconds < 1000) return `${milliseconds} ms`
    return t('aiQuality.seconds', {
      value: (milliseconds / 1000).toFixed(1),
    })
  }
  const openTrace = (trace: AiQualityTrace) => {
    if (trace.type === 'AGENT_RUN') {
      setSelectedRunId(trace.id)
      return
    }
    if (!trace.product) return
    const params = new URLSearchParams({
      merchantId,
      productId: trace.product.id,
      optimizationId: trace.id,
      keyword: trace.product.code,
    })
    void navigate(`/products?${params.toString()}`)
  }

  return (
    <main className="workspace-page ai-quality-page">
      <header className="workspace-header ai-quality-header">
        <div>
          <span className="page-kicker">{t('aiQuality.kicker')}</span>
          <h1>{t('aiQuality.title')}</h1>
          <p>
            {t('aiQuality.description', {
              merchant: currentMerchant?.name ?? t('aiQuality.merchant'),
            })}
          </p>
        </div>
        <Segmented<AiQualityWindowDays>
          value={days}
          options={[7, 30, 90].map((value) => ({
            value: value as AiQualityWindowDays,
            label: t('aiQuality.days', { count: value }),
          }))}
          onChange={setDays}
        />
      </header>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      {qualityQuery.isLoading && !report ? (
        <div className="ai-quality-loading">
          <Spin />
        </div>
      ) : report ? (
        <>
          <Alert
            className="ai-quality-scope-note"
            type="info"
            showIcon
            message={t('aiQuality.scopeTitle')}
            description={t('aiQuality.scopeDescription', {
              from: formatDate(report.period.from, language),
              to: formatDate(report.period.to, language),
            })}
          />

          <section
            className="ai-quality-metrics"
            aria-label={t('aiQuality.metrics')}
          >
            <MetricCard
              accent="success"
              label={t('aiQuality.acceptance')}
              value={formatRate(report.acceptance)}
              icon={<CheckCircleOutlined />}
              detail={t('aiQuality.acceptanceDetail', {
                accepted: report.acceptance.numerator,
                reviewed: report.acceptance.denominator,
                pending: report.generatedDrafts - report.reviewedDrafts,
              })}
            />
            <MetricCard
              accent="success"
              label={t('aiQuality.toolSuccess')}
              value={formatRate(report.toolCalls)}
              icon={<ThunderboltOutlined />}
              detail={t('aiQuality.ratioDetail', {
                numerator: report.toolCalls.numerator,
                denominator: report.toolCalls.denominator,
              })}
            />
            <MetricCard
              accent={
                (report.agentFailures.rate ?? 0) > 0 ? 'danger' : undefined
              }
              label={t('aiQuality.failureRate')}
              value={formatRate(report.agentFailures)}
              icon={<WarningOutlined />}
              detail={t('aiQuality.failureDetail', {
                failed: report.agentFailures.numerator,
                terminal: report.agentFailures.denominator,
                all: report.agentRuns,
              })}
            />
            <MetricCard
              accent="success"
              label={t('aiQuality.helpfulRate')}
              value={formatRate(report.helpfulFeedback)}
              icon={<LikeOutlined />}
              detail={t('aiQuality.helpfulDetail', {
                helpful: report.helpfulFeedback.numerator,
                total: report.helpfulFeedback.denominator,
              })}
            />
            <MetricCard
              label={t('aiQuality.latency')}
              value={formatDuration(report.averageAgentLatencyMs)}
              icon={<ClockCircleOutlined />}
              detail={t('aiQuality.latencyDetail')}
            />
            <MetricCard
              label={t('aiQuality.tokens')}
              value={number.format(report.tokenUsage.totalTokens)}
              icon={<RobotOutlined />}
              detail={t('aiQuality.tokenDetail', {
                prompt: number.format(report.tokenUsage.promptTokens),
                completion: number.format(report.tokenUsage.completionTokens),
              })}
            />
          </section>

          <section className="ai-quality-grid">
            <Card title={t('aiQuality.toolBreakdown')}>
              {report.tools.length ? (
                <Table
                  rowKey="name"
                  size="small"
                  pagination={false}
                  dataSource={report.tools}
                  columns={[
                    {
                      title: t('aiQuality.tool'),
                      dataIndex: 'name',
                      render: (name: string) =>
                        t(`agent.tools.${name}`, { defaultValue: name }),
                    },
                    {
                      title: t('aiQuality.calls'),
                      dataIndex: 'calls',
                      width: 80,
                    },
                    {
                      title: t('aiQuality.successRate'),
                      width: 160,
                      render: (_, item) => {
                        const percent =
                          item.successRate === null
                            ? 0
                            : Math.round(item.successRate * 100)
                        return (
                          <Progress
                            percent={percent}
                            size="small"
                            status={percent < 80 ? 'exception' : 'normal'}
                          />
                        )
                      },
                    },
                  ]}
                />
              ) : (
                <Empty description={t('aiQuality.noTools')} />
              )}
            </Card>

            <Card title={t('aiQuality.dailyTrend')}>
              <Table<AiQualityDailyPoint>
                rowKey="date"
                size="small"
                pagination={false}
                dataSource={[...report.daily].slice(-10).reverse()}
                columns={[
                  {
                    title: t('aiQuality.date'),
                    dataIndex: 'date',
                    render: (value: string) => formatDate(value, language),
                  },
                  {
                    title: t('aiQuality.agentRuns'),
                    dataIndex: 'agentRuns',
                    width: 90,
                  },
                  {
                    title: t('aiQuality.drafts'),
                    dataIndex: 'generatedDrafts',
                    width: 80,
                  },
                  {
                    title: t('aiQuality.tokens'),
                    dataIndex: 'totalTokens',
                    width: 100,
                    render: (value: number) => number.format(value),
                  },
                ]}
              />
            </Card>
          </section>

          <Card
            className="ai-quality-traces"
            title={t('aiQuality.recentTraces')}
            extra={
              <Button type="link" onClick={() => void navigate('/ai-results')}>
                {t('aiQuality.openResults')}
              </Button>
            }
          >
            <Table<AiQualityTrace>
              rowKey={(trace) => `${trace.type}:${trace.id}`}
              size="small"
              pagination={false}
              dataSource={report.recentTraces}
              columns={[
                {
                  title: t('aiQuality.type'),
                  dataIndex: 'type',
                  width: 150,
                  render: (value: AiQualityTrace['type']) =>
                    t(`aiQuality.types.${value}`),
                },
                {
                  title: t('aiQuality.trace'),
                  dataIndex: 'title',
                  ellipsis: true,
                },
                {
                  title: t('common.status'),
                  dataIndex: 'status',
                  width: 125,
                  render: (status: string) => (
                    <Tag color={statusColors[status] ?? 'default'}>
                      {status}
                    </Tag>
                  ),
                },
                {
                  title: t('aiQuality.latencyShort'),
                  dataIndex: 'latencyMs',
                  width: 110,
                  render: (value?: number) => formatDuration(value),
                },
                {
                  title: t('aiQuality.tokens'),
                  dataIndex: 'totalTokens',
                  width: 100,
                  render: (value: number) => number.format(value),
                },
                {
                  title: t('aiQuality.createdAt'),
                  dataIndex: 'createdAt',
                  width: 190,
                  render: (value: string) => formatDateTime(value, language),
                },
                {
                  title: t('common.actions'),
                  width: 110,
                  render: (_, trace) => (
                    <Button type="link" onClick={() => openTrace(trace)}>
                      {t('aiQuality.inspect')}
                    </Button>
                  ),
                },
              ]}
            />
          </Card>

          <Collapse
            className="ai-quality-methodology"
            items={[
              {
                key: 'methodology',
                label: (
                  <Space>
                    <ExperimentOutlined />
                    {t('aiQuality.methodology')}
                  </Space>
                ),
                children: (
                  <ul>
                    <li>{t('aiQuality.methodAcceptance')}</li>
                    <li>{t('aiQuality.methodTool')}</li>
                    <li>{t('aiQuality.methodFailure')}</li>
                    <li>{t('aiQuality.methodLatency')}</li>
                    <li>{t('aiQuality.methodTokens')}</li>
                    <li>{t('aiQuality.methodFeedback')}</li>
                  </ul>
                ),
              },
            ]}
          />
        </>
      ) : (
        <Empty description={t('aiQuality.noData')} />
      )}

      <Drawer
        title={t('aiQuality.agentTrace')}
        width={720}
        open={Boolean(selectedRunId)}
        onClose={() => setSelectedRunId(undefined)}
      >
        {runQuery.isLoading ? <Spin /> : null}
        {runQuery.data ? (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label={t('common.status')}>
                <Tag color={statusColors[runQuery.data.status]}>
                  {runQuery.data.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('aiQuality.tokens')}>
                {number.format(runQuery.data.usage.totalTokens)}
              </Descriptions.Item>
              <Descriptions.Item label={t('aiQuality.latency')} span={2}>
                {runQuery.data.completedAt
                  ? formatDuration(
                      new Date(runQuery.data.completedAt).getTime() -
                        new Date(runQuery.data.createdAt).getTime(),
                    )
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('aiQuality.input')} span={2}>
                {runQuery.data.message}
              </Descriptions.Item>
              <Descriptions.Item label={t('aiQuality.output')} span={2}>
                {runQuery.data.answer || runQuery.data.error || '—'}
              </Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} className="ai-quality-trace-heading">
              {t('agent.trace')}
            </Typography.Title>
            {runQuery.data.toolCalls.map((call) => (
              <div className="ai-quality-tool-trace" key={call.id}>
                <Space>
                  <Typography.Text strong>
                    {t(`agent.tools.${call.name}`)}
                  </Typography.Text>
                  <Tag color={call.status === 'success' ? 'green' : 'red'}>
                    {call.status}
                  </Tag>
                </Space>
                <pre>
                  {JSON.stringify(
                    call.output ?? call.error ?? call.input,
                    null,
                    2,
                  )}
                </pre>
              </div>
            ))}
          </>
        ) : null}
      </Drawer>
    </main>
  )
}
