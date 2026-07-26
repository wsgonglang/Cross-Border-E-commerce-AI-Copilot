import {
  AuditOutlined,
  SafetyCertificateOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'

import { useAppSelector } from '../store/hooks'

const capabilities = [
  {
    icon: <SafetyCertificateOutlined />,
    title: '服务端认证',
    text: '短期 Access Token 与可轮换 Refresh Token 已建立。',
  },
  {
    icon: <UserSwitchOutlined />,
    title: '角色权限',
    text: 'admin、operator、viewer 权限由 NestJS Guard 最终校验。',
  },
  {
    icon: <AuditOutlined />,
    title: '登录审计',
    text: '成功和失败登录都会写入 MySQL，便于追溯异常。',
  },
]

export function DashboardPage() {
  const user = useAppSelector((state) => state.auth.user)

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <span className="page-kicker">运营工作台</span>
          <h1>{user?.name}，欢迎回来</h1>
          <p>当前身份：{user?.roles.join(' · ')}</p>
        </div>
        <span className="secure-badge">
          <SafetyCertificateOutlined />
          已通过服务端认证
        </span>
      </header>

      <section className="auth-grid">
        {capabilities.map((capability) => (
          <article key={capability.title}>
            <div>{capability.icon}</div>
            <h2>{capability.title}</h2>
            <p>{capability.text}</p>
          </article>
        ))}
      </section>

      <section className="next-stage-card">
        <span>下一业务里程碑</span>
        <h2>商家、商品与 SKU</h2>
        <p>
          认证边界稳定后，商品数据将按商家隔离，并成为 AI
          优化草稿的真实业务上下文。
        </p>
      </section>
    </main>
  )
}
