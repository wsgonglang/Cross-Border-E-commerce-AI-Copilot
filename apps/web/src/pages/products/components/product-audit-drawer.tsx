import type { AuditLogSummary } from '@cross-border/shared'
import { Descriptions, Drawer } from 'antd'
import { useTranslation } from 'react-i18next'

import { formatDateTime } from '../../../i18n/formatters'
import type { AppLanguage } from '../../../i18n/i18n'

interface Props {
  open: boolean
  logs: AuditLogSummary[]
  language: AppLanguage
  onClose: () => void
}

export function ProductAuditDrawer({ open, logs, language, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <Drawer
      title={t('products.auditTitle')}
      width={560}
      open={open}
      onClose={onClose}
    >
      {logs.map((log) => (
        <Descriptions
          key={log.id}
          className="audit-entry"
          size="small"
          column={1}
          bordered
        >
          <Descriptions.Item label={t('products.time')}>
            {formatDateTime(log.createdAt, language)}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.actions')}>
            {log.entityType} · {log.action}
          </Descriptions.Item>
          <Descriptions.Item label={t('products.object')}>
            {log.entityId}
          </Descriptions.Item>
        </Descriptions>
      ))}
    </Drawer>
  )
}
