import {
  Alert,
  Button,
  Card,
  Col,
  List,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type {
  AiResultItem,
  DashboardOverview,
  DashboardTrend,
} from '@cross-border/shared'

import { getAiResults } from '../api/ai-results'
import { getDashboardOverview, getDashboardTrend } from '../api/orders'
import { useAppSelector } from '../store/hooks'

function TrendChart({ data }: { data: DashboardTrend }) {
  const maxOrders = Math.max(...data.orders, 1)
  const maxSales = Math.max(...data.sales.map(Number), 1)
  const w = data.dates.length * 40 + 40
  const h = 260
  const pad = { t: 20, r: 20, b: 40, l: 50 }

  const toX = (i: number) =>
    pad.l + (i * (w - pad.l - pad.r)) / (data.dates.length - 1 || 1)

  const orderPoints = data.orders
    .map(
      (v, i) =>
        `${toX(i)},${pad.t + (h - pad.t - pad.b) * (1 - v / maxOrders)}`,
    )
    .join(' ')

  const salesPoints = data.sales
    .map(
      (v, i) =>
        `${toX(i)},${pad.t + (h - pad.t - pad.b) * (1 - Number(v) / maxSales)}`,
    )
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: '100%', height: h }}
      role="img"
      aria-label="趋势图"
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = pad.t + (h - pad.t - pad.b) * (1 - f)
        return (
          <line
            key={f}
            x1={pad.l}
            y1={y}
            x2={w - pad.r}
            y2={y}
            stroke="#dbe7e4"
            strokeWidth="1"
          />
        )
      })}

      {/* Orders line */}
      <polyline
        points={orderPoints}
        fill="none"
        stroke="#0f766e"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {data.orders.map((v, i) => (
        <circle
          key={`o-${i}`}
          cx={toX(i)}
          cy={pad.t + (h - pad.t - pad.b) * (1 - v / maxOrders)}
          r="3"
          fill="#0f766e"
        />
      ))}

      {/* Sales line */}
      <polyline
        points={salesPoints}
        fill="none"
        stroke="#0891b2"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {data.sales.map((v, i) => (
        <circle
          key={`s-${i}`}
          cx={toX(i)}
          cy={pad.t + (h - pad.t - pad.b) * (1 - Number(v) / maxSales)}
          r="3"
          fill="#0891b2"
        />
      ))}

      {/* X axis labels */}
      {data.dates.map((d, i) => (
        <text
          key={d}
          x={toX(i)}
          y={h - 8}
          textAnchor="middle"
          fill="#607a76"
          fontSize="10"
        >
          {d.slice(5)}
        </text>
      ))}

      {/* Legend */}
      <rect x={w - 160} y={4} width="12" height="12" rx="2" fill="#0f766e" />
      <text x={w - 144} y={14} fill="#607a76" fontSize="11">
        订单数
      </text>
      <rect x={w - 90} y={4} width="12" height="12" rx="2" fill="#0891b2" />
      <text x={w - 74} y={14} fill="#607a76" fontSize="11">
        销售额
      </text>
    </svg>
  )
}

export function DashboardPage() {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const user = useAppSelector((state) => state.auth.user)
  const navigate = useNavigate()

  const merchantId = user?.merchantIds[0] ?? ''
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [trend, setTrend] = useState<DashboardTrend | null>(null)
  const [pendingDrafts, setPendingDrafts] = useState(0)
  const [recentResults, setRecentResults] = useState<AiResultItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !merchantId) return
    const load = async () => {
      try {
        const [ov, tr, drafts, recent] = await Promise.all([
          getDashboardOverview(token, merchantId),
          getDashboardTrend(token, merchantId),
          getAiResults(token, merchantId, {
            page: 1,
            pageSize: 1,
            type: 'PRODUCT_OPTIMIZATION',
            status: 'DRAFT',
          }),
          getAiResults(token, merchantId, {
            page: 1,
            pageSize: 3,
          }),
        ])
        setOverview(ov)
        setTrend(tr)
        setPendingDrafts(drafts.total)
        setRecentResults(recent.items)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [token, merchantId])

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <span className="page-kicker">运营工作台</span>
          <h1>{user?.name}，欢迎回来</h1>
          <p>当前身份：{user?.roles.join(' · ')}</p>
        </div>
        <span className="secure-badge">经营概览</span>
      </header>

      {error ? (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 18 }}
        />
      ) : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : overview ? (
        <>
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="今日订单"
                  value={overview.todayOrders}
                  suffix="单"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="今日销售额"
                  value={Number(overview.todaySales).toLocaleString('zh-CN', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                  })}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="商品总数" value={overview.totalProducts} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="库存预警"
                  value={overview.lowStockItems}
                  suffix="项"
                  valueStyle={
                    overview.lowStockItems > 0
                      ? { color: '#e74c3c' }
                      : undefined
                  }
                />
              </Card>
            </Col>
          </Row>

          <Card title="近 14 天趋势" style={{ marginTop: 18 }}>
            {trend ? <TrendChart data={trend} /> : null}
          </Card>

          <Card
            title="AI 待办与近期成果"
            style={{ marginTop: 18 }}
            extra={
              <Button type="link" onClick={() => void navigate('/ai-results')}>
                进入成果中心
              </Button>
            }
          >
            <Row gutter={24}>
              <Col xs={24} md={6}>
                <Statistic
                  title="待人工确认草稿"
                  value={pendingDrafts}
                  suffix="项"
                  valueStyle={
                    pendingDrafts > 0 ? { color: '#d97706' } : undefined
                  }
                />
              </Col>
              <Col xs={24} md={18}>
                <List
                  size="small"
                  locale={{ emptyText: '暂无 AI 成果' }}
                  dataSource={recentResults}
                  renderItem={(item) => (
                    <List.Item>
                      <Space>
                        <Tag>
                          {item.type === 'AGENT_RUN' ? 'Agent' : '商品优化'}
                        </Tag>
                        <Typography.Text ellipsis>{item.title}</Typography.Text>
                        <Tag>{item.status}</Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              </Col>
            </Row>
          </Card>
        </>
      ) : null}

      {!loading && !overview && !error ? (
        <Alert type="info" message="暂无经营数据" style={{ marginTop: 18 }} />
      ) : null}
    </main>
  )
}
