import { Button } from 'antd'
import { Component, type ErrorInfo, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import './styles.css'

interface BoundaryProps {
  children: ReactNode
  fallback: (error: Error, reset: () => void) => ReactNode
  resetKey: string
}

interface BoundaryState {
  error: Error | null
}

class RenderErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled route render error', error, info)
  }

  override componentDidUpdate(previousProps: BoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  private reset = () => this.setState({ error: null })

  override render() {
    return this.state.error
      ? this.props.fallback(this.state.error, this.reset)
      : this.props.children
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [resetVersion, setResetVersion] = useState(0)

  return (
    <RenderErrorBoundary
      resetKey={`${location.key}:${resetVersion}`}
      fallback={(error, reset) => (
        <main className="route-error-page" role="alert">
          <div className="brand-mark">CB</div>
          <h1>{t('app.renderErrorTitle')}</h1>
          <p>{t('app.renderErrorDescription')}</p>
          {import.meta.env.DEV ? (
            <code>{t('app.errorDetails', { message: error.message })}</code>
          ) : null}
          <div className="route-error-actions">
            <Button
              type="primary"
              onClick={() => {
                setResetVersion((current) => current + 1)
                reset()
              }}
            >
              {t('app.retryPage')}
            </Button>
            <Button
              onClick={() => {
                reset()
                void navigate('/')
              }}
            >
              {t('app.backToDashboard')}
            </Button>
          </div>
        </main>
      )}
    >
      {children}
    </RenderErrorBoundary>
  )
}
