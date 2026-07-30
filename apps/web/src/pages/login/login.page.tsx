import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input } from 'antd'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { login } from '../../store/auth.slice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'

import './styles.css'

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
  const { t } = useTranslation()
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
          <span className="stage-label">{t('login.stage')}</span>
          <h1>{t('login.storyTitle')}</h1>
          <p>{t('login.storyDescription')}</p>
        </div>
        <small>Stage 2 · Authentication &amp; RBAC</small>
      </section>

      <section className="login-panel">
        <div className="login-language">
          <LanguageSwitch />
        </div>
        <div className="login-card">
          <div className="login-heading">
            <span>{t('login.welcome')}</span>
            <h2>{t('login.title')}</h2>
            <p>{t('login.description')}</p>
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
              label={t('login.email')}
              name="email"
              rules={[
                { required: true, message: t('login.emailRequired') },
                { type: 'email', message: t('login.emailInvalid') },
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
              label={t('login.password')}
              name="password"
              rules={[
                { required: true, message: t('login.passwordRequired') },
                { min: 8, message: t('login.passwordMin') },
              ]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined />}
                autoComplete="current-password"
                placeholder={t('login.passwordPlaceholder')}
              />
            </Form.Item>
            <Button block size="large" type="primary" htmlType="submit">
              {t('login.submit')}
            </Button>
          </Form>

          <div className="demo-account">
            <span>{t('login.demo')}</span>
            <code>admin / operator / viewer @copilot.local</code>
            <code>{t('login.demoPassword')}</code>
          </div>
        </div>
      </section>
    </main>
  )
}
import { LanguageSwitch } from '../../components/language-switch/language-switch'
