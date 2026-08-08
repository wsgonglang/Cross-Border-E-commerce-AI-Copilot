import { Button, Result } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import './styles.css'

export function ForbiddenPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Result
      className="forbidden-page"
      status="403"
      title={t('app.forbiddenTitle')}
      subTitle={t('app.forbiddenDescription')}
      extra={
        <Button
          type="primary"
          onClick={() => {
            void navigate('/')
          }}
        >
          {t('app.backToDashboard')}
        </Button>
      }
    />
  )
}
