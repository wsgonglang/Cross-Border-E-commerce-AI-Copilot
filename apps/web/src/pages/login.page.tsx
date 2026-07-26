import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input } from 'antd'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { login } from '../store/auth.slice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

interface LoginValues {
  email: string
  password: string
}

function getReturnPath(state: unknown): string {
  if (typeof state !== 'object' || state === null) {
    return '/'
  }

  const from = (state as Record<string, unknown>).from
  return typeof from === 'string' && from.startsWith('/') ? from : '/'
}

export function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { status, error } = useAppSelector((state) => state.auth)

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  const submit = async (values: LoginValues) => {
    const result = await dispatch(login(values))
    if (login.fulfilled.match(result)) {
      await navigate(getReturnPath(location.state as unknown), {
        replace: true,
      })
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <div className="brand-mark">CB</div>
          <span>Cross-Border E-commerce AI Copilot</span>
        </div>
        <div>
          <span className="stage-label">安全运营工作台</span>
          <h1>让每一次 AI 操作，都有身份、权限与记录。</h1>
          <p>
            从登录开始建立可信边界。AI
            可以生成建议，但正式业务变更始终受服务端权限与人工确认控制。
          </p>
        </div>
        <small>Stage 2 · Authentication &amp; RBAC</small>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-heading">
            <span>欢迎回来</span>
            <h2>登录运营助手</h2>
            <p>使用项目演示账号进入对应角色工作台。</p>
          </div>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Form<LoginValues>
            layout="vertical"
            requiredMark={false}
            initialValues={{
              email: 'operator@copilot.local',
              password: 'Demo123!',
            }}
            onFinish={(values) => void submit(values)}
          >
            <Form.Item
              label="邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '邮箱格式不正确' },
              ]}
            >
              <Input
                size="large"
                prefix={<MailOutlined />}
                autoComplete="username"
                placeholder="name@example.com"
              />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 8, message: '密码至少 8 位' },
              ]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined />}
                autoComplete="current-password"
                placeholder="输入密码"
              />
            </Form.Item>
            <Button block size="large" type="primary" htmlType="submit">
              安全登录
            </Button>
          </Form>

          <div className="demo-account">
            <span>演示账号</span>
            <code>admin / operator / viewer @copilot.local</code>
            <code>统一密码：Demo123!</code>
          </div>
        </div>
      </section>
    </main>
  )
}
