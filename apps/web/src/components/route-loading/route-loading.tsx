import { useTranslation } from 'react-i18next'

import './styles.css'

export function RouteLoading() {
  const { t } = useTranslation()

  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-spinner" aria-hidden="true" />
      <span>{t('app.loading')}</span>
    </div>
  )
}
