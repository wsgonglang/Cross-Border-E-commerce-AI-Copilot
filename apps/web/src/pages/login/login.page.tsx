import {
  CheckCircleFilled,
  LockOutlined,
  MailOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Alert, Button, Form, Input, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { LanguageSwitch } from '../../components/language-switch/language-switch'
import { login } from '../../store/auth.slice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'

import './styles.css'

interface LoginValues {
  email: string
  password: string
}

type DemoRole = 'admin' | 'operator' | 'viewer'

function getReturnPath(state: unknown): string {
  if (typeof state !== 'object' || state === null) {
    return '/'
  }

  const from = (state as Record<string, unknown>).from
  return typeof from === 'string' && from.startsWith('/') ? from : '/'
}

export function LoginPage() {
  const { t } = useTranslation()
  const [form] = Form.useForm<LoginValues>()
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

  const selectDemoRole = (role: DemoRole) => {
    form.setFieldsValue({
      email: `${role}@copilot.local`,
      password: 'Demo123!',
    })
  }

  const capabilities = [
    t('login.capabilityContext'),
    t('login.capabilityApproval'),
    t('login.capabilityAudit'),
  ]

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <div className="brand-mark">CB</div>
          <div>
            <strong>AI Copilot</strong>
            <span>{t('nav.brandSubtitle')}</span>
          </div>
        </div>

        <div className="login-story-content">
          <span className="stage-label">{t('login.stage')}</span>
          <h1>{t('login.storyTitle')}</h1>
          <p>{t('login.storyDescription')}</p>

          <div className="login-capabilities">
            {capabilities.map((capability) => (
              <span key={capability}>
                <CheckCircleFilled />
                {capability}
              </span>
            ))}
          </div>
        </div>

        <div className="login-workspace-preview">
          <div className="login-preview-heading">
            <div>
              <span>{t('login.previewKicker')}</span>
              <strong>{t('login.previewTitle')}</strong>
            </div>
            <Tag color="success">{t('login.previewLive')}</Tag>
          </div>
          <div className="login-preview-grid">
            <div>
              <span>{t('login.previewDrafts')}</span>
              <strong>15</strong>
              <small>{t('login.previewDraftsHint')}</small>
            </div>
            <div>
              <span>{t('login.previewAgent')}</span>
              <strong>6</strong>
              <small>{t('login.previewAgentHint')}</small>
            </div>
            <div>
              <span>{t('login.previewRisk')}</span>
              <strong>1</strong>
              <small>{t('login.previewRiskHint')}</small>
            </div>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-toolbar">
          <span>{t('login.interfaceLanguage')}</span>
          <LanguageSwitch />
        </div>
        <div className="login-card">
          <div className="login-card-icon">
            <RobotOutlined />
          </div>
          <div className="login-heading">
            <span>{t('login.welcome')}</span>
            <h2>{t('login.title')}</h2>
            <p>{t('login.description')}</p>
          </div>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          <Form<LoginValues>
            form={form}
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
            <div className="demo-account-heading">
              <span>{t('login.demo')}</span>
              <code>{t('login.demoPassword')}</code>
            </div>
            <div className="demo-role-list">
              {(['operator', 'admin', 'viewer'] as const).map((role) => (
                <Button
                  key={role}
                  size="small"
                  onClick={() => selectDemoRole(role)}
                >
                  {t(`login.roles.${role}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="login-security-note">
            <SafetyCertificateOutlined />
            <span>{t('login.securityNote')}</span>
          </div>
        </div>
      </section>
    </main>
  )
}
