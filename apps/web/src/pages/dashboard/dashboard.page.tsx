import type {
  DashboardComparisonMetric,
  DashboardMoneyComparisonMetric,
  OperationsDashboard,
} from '@cross-border/shared'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  List,
  Progress,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { getOperationsDashboard } from '../../api/orders'
import { useBusinessContext } from '../../contexts/business-context'
import {
  formatCurrency,
  formatDate,
  formatMonthDay,
} from '../../i18n/formatters'
import type { AppLanguage } from '../../i18n/i18n'
import { useRecentAiSessionsQuery } from '../../queries/operations.queries'
import { useAppSelector } from '../../store/hooks'
import { DashboardAiEntry } from './dashboard-ai-entry'
import { getDashboardResultPath } from './dashboard-navigation'

import './styles.css'

function Comparison({
  metric,
}: {
  metric: DashboardComparisonMetric | DashboardMoneyComparisonMetric
}) {
  const { t } = useTranslation()
  if (metric.changeRate === null) {
    return (
      <span className="metric-comparison muted">{t('dashboard.noBase')}</span>
    )
  }
  const increased = metric.changeRate >= 0
  return (
    <span
      className={`metric-comparison ${
        increased ? 'metric-positive' : 'metric-negative'
      }`}
    >
      {increased ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
      {t('dashboard.versusPrevious', {
        rate: Math.abs(metric.changeRate).toFixed(1),
      })}
    </span>
  )
}

function TrendChart({ data }: { data: OperationsDashboard['trend'] }) {
  const { t, i18n } = useTranslation()
  const language: AppLanguage =
    i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN'
  const maxOrders = Math.max(...data.orders, 1)
  const maxSales = Math.max(...data.sales.map(Number), 1)
  const width = Math.max(data.dates.length * 54, 620)
  const height = 260
  const padding = { top: 22, right: 24, bottom: 42, left: 34 }
  const x = (index: number) =>
    padding.left +
    (index * (width - padding.left - padding.right)) /
      (data.dates.length - 1 || 1)
  const y = (value: number, max: number) =>
    padding.top + (height - padding.top - padding.bottom) * (1 - value / max)

  return (
    <div className="dashboard-chart-scroll">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="dashboard-trend-chart"
        role="img"
        aria-label={t('dashboard.trendAria')}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const lineY =
            padding.top +
            (height - padding.top - padding.bottom) * (1 - fraction)
          return (
            <line
              key={fraction}
              x1={padding.left}
              y1={lineY}
              x2={width - padding.right}
              y2={lineY}
              stroke="#dbe7e4"
            />
          )
        })}
        <polyline
          points={data.orders
            .map((value, index) => `${x(index)},${y(value, maxOrders)}`)
            .join(' ')}
          fill="none"
          stroke="#0f766e"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <polyline
          points={data.sales
            .map((value, index) => `${x(index)},${y(Number(value), maxSales)}`)
            .join(' ')}
          fill="none"
          stroke="#0891b2"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {data.dates.map((date, index) => (
          <text
            key={date}
            x={x(index)}
            y={height - 12}
            textAnchor="middle"
            fill="#607a76"
            fontSize="11"
          >
            {formatMonthDay(date, language)}
          </text>
        ))}
        <rect
          x={width - 176}
          y={3}
          width="12"
          height="12"
          rx="2"
          fill="#0f766e"
        />
        <text x={width - 158} y={14} fill="#607a76" fontSize="11">
          {t('dashboard.orders')}
        </text>
        <rect
          x={width - 98}
          y={3}
          width="12"
          height="12"
          rx="2"
          fill="#0891b2"
        />
        <text x={width - 80} y={14} fill="#607a76" fontSize="11">
          {t('dashboard.sales')}
        </text>
      </svg>
    </div>
  )
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const language: AppLanguage =
    i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN'
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const user = useAppSelector((state) => state.auth.user)
  const { merchantId, storeId, currentStore } = useBusinessContext()
  const navigate = useNavigate()
  const [days, setDays] = useState(7)
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const recentSessionsQuery = useRecentAiSessionsQuery(token, merchantId)

  useEffect(() => {
    if (!token || !merchantId) return
    let active = true
    void getOperationsDashboard(token, merchantId, {
      days,
      storeId: storeId || undefined,
    })
      .then((result) => {
        if (!active) return
        setDashboard(result)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : t('dashboard.loadFailed'),
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [days, merchantId, storeId, t, token])

  const suggestions = useMemo(() => {
    if (!dashboard) return []
    return [
      dashboard.todos.actionableOrders > 0
        ? {
            title: t('dashboard.suggestionOrders'),
            evidence: t('dashboard.suggestionOrdersEvidence', {
              count: dashboard.todos.actionableOrders,
            }),
            action: t('dashboard.viewOrders'),
            path: '/orders',
            aiPrompt: t('dashboard.aiPromptActionableOrders', {
              count: dashboard.todos.actionableOrders,
              days,
            }),
          }
        : null,
      dashboard.todos.lowStockItems > 0
        ? {
            title: t('dashboard.suggestionLowStock'),
            evidence: t('dashboard.suggestionLowStockEvidence', {
              count: dashboard.todos.lowStockItems,
            }),
            action: t('dashboard.viewProducts'),
            path: '/products',
            aiPrompt: t('dashboard.aiPromptLowStock', {
              count: dashboard.todos.lowStockItems,
            }),
          }
        : null,
      dashboard.todos.pendingDrafts > 0
        ? {
            title: t('dashboard.suggestionDrafts'),
            evidence: t('dashboard.suggestionDraftsEvidence', {
              count: dashboard.todos.pendingDrafts,
            }),
            action: t('dashboard.reviewDrafts'),
            path: '/ai-results',
            aiPrompt: t('dashboard.aiPromptReviewDrafts', {
              count: dashboard.todos.pendingDrafts,
            }),
          }
        : null,
      dashboard.todos.failedTasks > 0
        ? {
            title: t('dashboard.suggestionTasks'),
            evidence: t('dashboard.suggestionTasksEvidence', {
              count: dashboard.todos.failedTasks,
            }),
            action: t('dashboard.viewTasks'),
            path: '/batch-tasks',
            aiPrompt: t('dashboard.aiPromptFailedTasks', {
              count: dashboard.todos.failedTasks,
            }),
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null)
  }, [dashboard, days, t])

  const canWrite =
    user?.roles.some((role) => ['admin', 'operator'].includes(role)) ?? false

  const openAiAssistant = (state?: {
    prefill?: string
    sessionId?: string
  }) => {
    void navigate('/ai-chat', state ? { state } : undefined)
  }

  return (
    <main className="workspace-page dashboard-workspace">
      <header className="workspace-header">
        <div>
          <span className="page-kicker">{t('dashboard.kicker')}</span>
          <h1>{t('dashboard.welcome', { name: user?.name })}</h1>
          <p>
            {currentStore
              ? `${currentStore.name} · ${currentStore.platform} · ${currentStore.market}`
              : t('dashboard.allStores')}
          </p>
        </div>
        <Space direction="vertical" align="end">
          <span className="secure-badge">{t('dashboard.verified')}</span>
          <Segmented
            value={days}
            options={[
              { label: t('dashboard.range7'), value: 7 },
              { label: t('dashboard.range14'), value: 14 },
              { label: t('dashboard.range30'), value: 30 },
            ]}
            onChange={(value) => setDays(Number(value))}
          />
        </Space>
      </header>

      {error ? <Alert type="error" showIcon title={error} /> : null}
      {loading ? (
        <div className="dashboard-loading">
          <Spin size="large" />
        </div>
      ) : dashboard ? (
        <>
          <Typography.Text type="secondary" className="dashboard-period">
            {t('dashboard.period', {
              start: formatDate(dashboard.period.startDate, language),
              end: formatDate(dashboard.period.endDate, language),
            })}
          </Typography.Text>

          <Row gutter={[16, 16]} className="dashboard-metrics">
            <Col xs={24} sm={12} xl={6}>
              <Card>
                <Statistic
                  title={t('dashboard.sales')}
                  value={formatCurrency(
                    dashboard.metrics.sales.value,
                    dashboard.currency,
                    language,
                  )}
                />
                <Comparison metric={dashboard.metrics.sales} />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card>
                <Statistic
                  title={t('dashboard.orders')}
                  value={dashboard.metrics.orders.value}
                  suffix={t('dashboard.orderUnit')}
                />
                <Comparison metric={dashboard.metrics.orders} />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card>
                <Statistic
                  title={t('dashboard.averageOrder')}
                  value={formatCurrency(
                    dashboard.metrics.averageOrderValue.value,
                    dashboard.currency,
                    language,
                  )}
                />
                <Comparison metric={dashboard.metrics.averageOrderValue} />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card>
                <Statistic
                  title={t('dashboard.refunds')}
                  value={dashboard.metrics.refunds.value}
                  suffix={t('dashboard.orderUnit')}
                />
                <Comparison metric={dashboard.metrics.refunds} />
              </Card>
            </Col>
          </Row>

          <Row
            gutter={[16, 16]}
            className="dashboard-section dashboard-priority-row"
          >
            <Col xs={24} xl={14}>
              <Card
                title={t('dashboard.todoTitle')}
                className="dashboard-full-card"
              >
                <Row gutter={[12, 12]}>
                  {[
                    [
                      t('dashboard.actionableOrders'),
                      dashboard.todos.actionableOrders,
                      '/orders?statuses=PENDING,CONFIRMED,REFUNDING',
                    ],
                    [
                      t('dashboard.pendingDrafts'),
                      dashboard.todos.pendingDrafts,
                      '/ai-results',
                    ],
                    [
                      t('dashboard.failedTasks'),
                      dashboard.todos.failedTasks,
                      '/batch-tasks',
                    ],
                    [
                      t('dashboard.lowStockSku'),
                      dashboard.todos.lowStockItems,
                      '/products',
                    ],
                  ].map(([title, value, path]) => (
                    <Col xs={12} lg={6} key={String(title)}>
                      <button
                        type="button"
                        className="dashboard-todo"
                        onClick={() => void navigate(String(path))}
                      >
                        <span>{title}</span>
                        <strong>{value}</strong>
                      </button>
                    </Col>
                  ))}
                </Row>
                <List
                  className="dashboard-suggestions"
                  locale={{ emptyText: t('dashboard.noPriorityIssue') }}
                  dataSource={suggestions}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          key="business"
                          type="link"
                          onClick={() => void navigate(item.path)}
                        >
                          {item.action}
                        </Button>,
                        <Button
                          key="assistant"
                          type="link"
                          onClick={() =>
                            openAiAssistant({ prefill: item.aiPrompt })
                          }
                        >
                          {t('dashboard.askAssistant')}
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<BulbOutlined className="suggestion-icon" />}
                        title={item.title}
                        description={t('dashboard.evidence', {
                          evidence: item.evidence,
                        })}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <DashboardAiEntry
                canWrite={canWrite}
                days={days}
                loadingSessions={recentSessionsQuery.isFetching}
                onOpen={openAiAssistant}
                sessionError={
                  recentSessionsQuery.error instanceof Error
                    ? recentSessionsQuery.error.message
                    : undefined
                }
                sessions={recentSessionsQuery.data?.items ?? []}
                storeName={currentStore?.name}
              />
            </Col>
          </Row>

          <Row
            gutter={[16, 16]}
            className="dashboard-section dashboard-equal-row"
          >
            <Col xs={24} xl={16}>
              <Card
                title={t('dashboard.trendTitle', { days })}
                className="dashboard-full-card"
              >
                <TrendChart data={dashboard.trend} />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card
                title={t('dashboard.statusDistribution')}
                className="dashboard-full-card"
              >
                {dashboard.orderStatuses.length ? (
                  <Space direction="vertical" className="dashboard-status-list">
                    {dashboard.orderStatuses.map((item) => (
                      <div key={item.status}>
                        <Space className="dashboard-status-heading">
                          <span>
                            {t(`dashboard.status.${item.status}`, {
                              defaultValue: item.status,
                            })}
                          </span>
                          <strong>{item.count}</strong>
                        </Space>
                        <Progress
                          percent={Math.round(
                            (item.count /
                              Math.max(dashboard.metrics.orders.value, 1)) *
                              100,
                          )}
                          showInfo={false}
                          strokeColor="#0f766e"
                        />
                      </div>
                    ))}
                  </Space>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>
          </Row>

          <Row
            gutter={[16, 16]}
            className="dashboard-section dashboard-equal-row"
          >
            <Col xs={24} xl={12}>
              <Card
                title={t('dashboard.topProducts')}
                className="dashboard-full-card"
              >
                <Table
                  size="small"
                  rowKey="productName"
                  pagination={false}
                  dataSource={dashboard.topProducts}
                  columns={[
                    {
                      title: t('dashboard.product'),
                      dataIndex: 'productName',
                      ellipsis: true,
                    },
                    {
                      title: t('dashboard.quantity'),
                      dataIndex: 'quantity',
                      width: 80,
                    },
                    {
                      title: t('dashboard.sales'),
                      dataIndex: 'sales',
                      width: 120,
                      render: (value: string) =>
                        formatCurrency(value, dashboard.currency, language),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card
                title={t('dashboard.lowStock')}
                className="dashboard-full-card"
                extra={
                  <Button
                    type="link"
                    onClick={() => void navigate('/products')}
                  >
                    {t('dashboard.productManagement')}
                  </Button>
                }
              >
                <Table
                  size="small"
                  rowKey="skuId"
                  pagination={false}
                  dataSource={dashboard.lowStock}
                  columns={[
                    {
                      title: t('dashboard.productSku'),
                      render: (_, item) => (
                        <Space direction="vertical" size={0}>
                          <span>{item.productTitle}</span>
                          <Typography.Text type="secondary">
                            {item.productCode} / {item.skuCode}
                          </Typography.Text>
                        </Space>
                      ),
                    },
                    {
                      title: t('dashboard.stock'),
                      dataIndex: 'stock',
                      width: 70,
                      render: (value: number) => (
                        <Tag color={value === 0 ? 'red' : 'orange'}>
                          {value}
                        </Tag>
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          <section className="dashboard-section dashboard-activity-section">
            <div className="dashboard-section-heading">
              <div>
                <Typography.Title level={3}>
                  {t('dashboard.activityTitle')}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {t('dashboard.activityDescription')}
                </Typography.Text>
              </div>
            </div>
            <Row gutter={[16, 16]} className="dashboard-equal-row">
              <Col xs={24} xl={12}>
                <Card
                  title={t('dashboard.inProgress')}
                  className="dashboard-full-card"
                  extra={
                    <Button
                      type="link"
                      onClick={() => void navigate('/batch-tasks')}
                    >
                      {t('dashboard.taskCenter')}
                    </Button>
                  }
                >
                  <Space wrap className="dashboard-running-summary">
                    <Tag color="processing">
                      {t('dashboard.runningAgents', {
                        count: dashboard.runningAgentCount,
                      })}
                    </Tag>
                    <Tag color="cyan">
                      {t('dashboard.batchCount', {
                        count: dashboard.activeTasks.length,
                      })}
                    </Tag>
                  </Space>
                  <List
                    size="small"
                    locale={{ emptyText: t('dashboard.noRunningTasks') }}
                    dataSource={dashboard.activeTasks}
                    renderItem={(task) => (
                      <List.Item
                        className="clickable-list-item dashboard-result-item"
                        onClick={() =>
                          void navigate(
                            `/batch-tasks?merchantId=${merchantId}&taskId=${task.id}`,
                          )
                        }
                      >
                        <Space
                          direction="vertical"
                          className="dashboard-list-row"
                        >
                          <Space>
                            <Tag color="processing">
                              {t(`dashboard.taskStatus.${task.status}`, {
                                defaultValue: task.status,
                              })}
                            </Tag>
                            <span>
                              {t('dashboard.batchForLanguage', {
                                language: task.targetLanguage,
                              })}
                            </span>
                          </Space>
                          <Progress percent={task.progress} size="small" />
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={12}>
                <Card
                  title={t('dashboard.needsAttention')}
                  className="dashboard-full-card"
                  extra={
                    <Button
                      type="link"
                      onClick={() => void navigate('/ai-results')}
                    >
                      {t('dashboard.resultCenter')}
                    </Button>
                  }
                >
                  <List
                    size="small"
                    locale={{ emptyText: t('dashboard.noResults') }}
                    dataSource={dashboard.recentResults}
                    renderItem={(item) => (
                      <List.Item
                        className="clickable-list-item"
                        onClick={() =>
                          void navigate(
                            getDashboardResultPath(item, merchantId),
                          )
                        }
                      >
                        <List.Item.Meta
                          title={
                            <Space className="dashboard-result-title">
                              <Tag>
                                {item.type === 'AGENT_RUN'
                                  ? t('dashboard.agentResult')
                                  : t('dashboard.productDraft')}
                              </Tag>
                              <Typography.Text ellipsis>
                                {item.title}
                              </Typography.Text>
                            </Space>
                          }
                          description={item.description}
                        />
                        <Tag>
                          {t(`dashboard.resultStatus.${item.status}`, {
                            defaultValue: item.status,
                          })}
                        </Tag>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
            </Row>
          </section>
        </>
      ) : (
        <Empty description={t('dashboard.noData')} />
      )}
    </main>
  )
}
