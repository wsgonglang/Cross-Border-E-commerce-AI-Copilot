import {
  ApiOutlined,
  CheckCircleFilled,
  DatabaseOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { Tag } from 'antd'

import { useApiHealth } from './hooks/useApiHealth'

const foundations = [
  {
    icon: <DatabaseOutlined />,
    title: '业务后台',
    description: '商品、SKU、订单与权限能力将在统一业务服务中逐步落地。',
  },
  {
    icon: <RobotOutlined />,
    title: 'AI 运营助手',
    description: '保留流式交互优势，让 AI 生成可审核、可追溯的业务草稿。',
  },
  {
    icon: <ApiOutlined />,
    title: '可靠服务',
    description: 'NestJS API 与独立 Worker 为后续审计和异步任务提供基础。',
  },
]

const healthLabels = {
  checking: { color: 'processing', text: '正在检查 API' },
  online: { color: 'success', text: 'API 运行正常' },
  offline: { color: 'error', text: 'API 尚未启动' },
} as const

export function App() {
  const health = useApiHealth()
  const healthLabel = healthLabels[health]

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">CB</div>
        <div>
          <p className="eyebrow">Cross-Border E-commerce</p>
          <h1>AI Copilot</h1>
        </div>
        <Tag color={healthLabel.color} className="health-tag">
          {healthLabel.text}
        </Tag>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="stage-label">工程阶段 1 · 融合基础</span>
          <h2>让 AI 进入业务流程，而不只是进入聊天框。</h2>
          <p>
            新工程骨架已经独立于两个参考项目建立。下一步将从真实身份认证和服务端权限开始，
            逐段打通商品运营的核心链路。
          </p>
        </div>
        <div className="milestone">
          <CheckCircleFilled />
          <div>
            <strong>基础服务已就位</strong>
            <span>Web · API · Worker · Shared</span>
          </div>
        </div>
      </section>

      <section className="foundation-grid" aria-label="工程基础能力">
        {foundations.map((foundation) => (
          <article key={foundation.title} className="foundation-card">
            <div className="card-icon">{foundation.icon}</div>
            <h3>{foundation.title}</h3>
            <p>{foundation.description}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
