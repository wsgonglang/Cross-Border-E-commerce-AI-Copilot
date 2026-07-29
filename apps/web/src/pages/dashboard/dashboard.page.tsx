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
  RobotOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { getOperationsDashboard } from '../../api/orders'
import { AgentPanel } from '../../components/agent-panel/agent-panel'
import { useBusinessContext } from '../../contexts/business-context'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

const orderStatusLabels: Record<string, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  SHIPPED: '已发货',
  DELIVERED: '已送达',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
}

function formatMoney(value: string, currency: string): string {
  return Number(value).toLocaleString('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  })
}

function Comparison({
  metric,
}: {
  metric: DashboardComparisonMetric | DashboardMoneyComparisonMetric
}) {
  if (metric.changeRate === null) {
    return <span className="metric-comparison muted">上一周期无基数</span>
  }
  const increased = metric.changeRate >= 0
  return (
    <span
      className={`metric-comparison ${
        increased ? 'metric-positive' : 'metric-negative'
      }`}
    >
      {increased ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
      {Math.abs(metric.changeRate).toFixed(1)}% 较上一周期
    </span>
  )
}

function TrendChart({ data }: { data: OperationsDashboard['trend'] }) {
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
        aria-label="订单和销售趋势"
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
            {date.slice(5)}
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
          订单数
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
          销售额
        </text>
      </svg>
    </div>
  )
}

export function DashboardPage() {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const user = useAppSelector((state) => state.auth.user)
  const { merchantId, storeId, currentStore } = useBusinessContext()
  const navigate = useNavigate()
  const [days, setDays] = useState(7)
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          loadError instanceof Error ? loadError.message : '运营工作台加载失败',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [days, merchantId, storeId, token])

  const suggestions = useMemo(() => {
    if (!dashboard) return []
    return [
      dashboard.todos.actionableOrders > 0
        ? {
            title: '优先处理未完成订单',
            evidence: `当前店铺有 ${dashboard.todos.actionableOrders} 笔待确认、已确认或退款中的订单。`,
            action: '查看订单',
            path: '/orders',
          }
        : null,
      dashboard.todos.lowStockItems > 0
        ? {
            title: '检查低库存商品',
            evidence: `${dashboard.todos.lowStockItems} 个在售 SKU 库存不高于 5。`,
            action: '查看商品',
            path: '/products',
          }
        : null,
      dashboard.todos.pendingDrafts > 0
        ? {
            title: '审核 AI 商品草稿',
            evidence: `成果中心有 ${dashboard.todos.pendingDrafts} 份草稿等待人工确认。`,
            action: '审核草稿',
            path: '/ai-results',
          }
        : null,
      dashboard.todos.failedTasks > 0
        ? {
            title: '处理失败批量任务',
            evidence: `${dashboard.todos.failedTasks} 个批量任务存在失败明细。`,
            action: '查看任务',
            path: '/batch-tasks',
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null)
  }, [dashboard])

  const canWrite =
    user?.roles.some((role) => ['admin', 'operator'].includes(role)) ?? false

  return (
    <main className="workspace-page dashboard-workspace">
      <header className="workspace-header">
        <div>
          <span className="page-kicker">Agent 运营工作台</span>
          <h1>{user?.name}，欢迎回来</h1>
          <p>
            {currentStore
              ? `${currentStore.name} · ${currentStore.platform} · ${currentStore.market}`
              : '当前商家全部店铺'}
          </p>
        </div>
        <Space direction="vertical" align="end">
          <span className="secure-badge">指标来自真实业务数据</span>
          <Segmented
            value={days}
            options={[
              { label: '近 7 天', value: 7 },
              { label: '近 14 天', value: 14 },
              { label: '近 30 天', value: 30 },
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
          <Typography.Text type="secondary">
            当前周期 {dashboard.period.startDate.slice(0, 10)} 至{' '}
            {dashboard.period.endDate.slice(0, 10)}，对比之前等长周期
          </Typography.Text>

          <Row gutter={[16, 16]} className="dashboard-metrics">
            <Col xs={24} sm={12} xl={6}>
              <Card>
                <Statistic
                  title="销售额"
                  value={formatMoney(
                    dashboard.metrics.sales.value,
                    dashboard.currency,
                  )}
                />
                <Comparison metric={dashboard.metrics.sales} />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card>
                <Statistic
                  title="订单数"
                  value={dashboard.metrics.orders.value}
                  suffix="单"
                />
                <Comparison metric={dashboard.metrics.orders} />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card>
                <Statistic
                  title="平均客单价"
                  value={formatMoney(
                    dashboard.metrics.averageOrderValue.value,
                    dashboard.currency,
                  )}
                />
                <Comparison metric={dashboard.metrics.averageOrderValue} />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card>
                <Statistic
                  title="退款单量"
                  value={dashboard.metrics.refunds.value}
                  suffix="单"
                />
                <Comparison metric={dashboard.metrics.refunds} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={16}>
              <Card title={`${days} 天销售与订单趋势`}>
                <TrendChart data={dashboard.trend} />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card title="订单状态分布" className="dashboard-full-card">
                {dashboard.orderStatuses.length ? (
                  <Space direction="vertical" className="dashboard-status-list">
                    {dashboard.orderStatuses.map((item) => (
                      <div key={item.status}>
                        <Space className="dashboard-status-heading">
                          <span>
                            {orderStatusLabels[item.status] ?? item.status}
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

          <Row gutter={[16, 16]} className="dashboard-section">
            <Col xs={24} xl={12}>
              <Card title="热销商品">
                <Table
                  size="small"
                  rowKey="productName"
                  pagination={false}
                  dataSource={dashboard.topProducts}
                  columns={[
                    { title: '商品', dataIndex: 'productName', ellipsis: true },
                    { title: '销量', dataIndex: 'quantity', width: 80 },
                    {
                      title: '销售额',
                      dataIndex: 'sales',
                      width: 120,
                      render: (value: string) =>
                        formatMoney(value, dashboard.currency),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card
                title="低库存明细"
                extra={
                  <Button
                    type="link"
                    onClick={() => void navigate('/products')}
                  >
                    商品管理
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
                      title: '商品 / SKU',
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
                      title: '库存',
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

          <Card title="运营待办与可解释建议" className="dashboard-section">
            <Row gutter={[16, 16]}>
              {[
                [
                  '待处理订单',
                  dashboard.todos.actionableOrders,
                  '/orders?statuses=PENDING,CONFIRMED,REFUNDING',
                ],
                ['待确认草稿', dashboard.todos.pendingDrafts, '/ai-results'],
                ['失败任务', dashboard.todos.failedTasks, '/batch-tasks'],
                ['低库存 SKU', dashboard.todos.lowStockItems, '/products'],
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
              locale={{ emptyText: '当前没有需要优先处理的异常' }}
              dataSource={suggestions}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key={item.path}
                      type="link"
                      onClick={() => void navigate(item.path)}
                    >
                      {item.action}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<RobotOutlined className="suggestion-icon" />}
                    title={item.title}
                    description={`业务依据：${item.evidence}`}
                  />
                </List.Item>
              )}
            />
          </Card>

          <Row gutter={[16, 16]} className="dashboard-section">
            <Col xs={24} xl={12}>
              <Card
                title="运行中任务"
                extra={
                  <Button
                    type="link"
                    onClick={() => void navigate('/batch-tasks')}
                  >
                    任务中心
                  </Button>
                }
              >
                <Space wrap className="dashboard-running-summary">
                  <Tag color="processing">
                    Agent 运行中 {dashboard.runningAgentCount}
                  </Tag>
                  <Tag color="cyan">
                    批量任务 {dashboard.activeTasks.length}
                  </Tag>
                </Space>
                <List
                  size="small"
                  locale={{ emptyText: '暂无运行中的批量任务' }}
                  dataSource={dashboard.activeTasks}
                  renderItem={(task) => (
                    <List.Item>
                      <Space
                        direction="vertical"
                        className="dashboard-list-row"
                      >
                        <Space>
                          <Tag color="processing">{task.status}</Tag>
                          <span>批量优化为 {task.targetLanguage}</span>
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
                title="近期 AI 成果"
                extra={
                  <Button
                    type="link"
                    onClick={() => void navigate('/ai-results')}
                  >
                    成果中心
                  </Button>
                }
              >
                <List
                  size="small"
                  locale={{ emptyText: '暂无 AI 成果' }}
                  dataSource={dashboard.recentResults}
                  renderItem={(item) => (
                    <List.Item
                      className="clickable-list-item"
                      onClick={() => void navigate('/ai-results')}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag>
                              {item.type === 'AGENT_RUN' ? 'Agent' : '商品草稿'}
                            </Tag>
                            <Typography.Text ellipsis>
                              {item.title}
                            </Typography.Text>
                          </Space>
                        }
                        description={item.description}
                      />
                      <Tag>{item.status}</Tag>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title="当前上下文 Agent"
            className="dashboard-section dashboard-agent-card"
            extra={
              <Tag color="cyan">
                {currentStore?.name ?? '全部店铺'} · 近 {days} 天
              </Tag>
            }
          >
            <Typography.Paragraph type="secondary">
              Agent
              会继承当前商家、店铺和时间范围；所有结论均可在工具轨迹中核对。
              {canWrite
                ? '创建商品草稿后仍需人工确认。'
                : '当前 viewer 身份仅可使用只读业务工具。'}
            </Typography.Paragraph>
            <AgentPanel
              token={token}
              merchantId={merchantId}
              storeId={storeId || undefined}
              storeName={currentStore?.name}
              days={days}
              sourcePage="dashboard"
              canWrite={canWrite}
            />
          </Card>
        </>
      ) : (
        <Empty description="暂无可展示的经营数据" />
      )}
    </main>
  )
}
