import { GlobalOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import { useTranslation } from 'react-i18next'

import { changeAppLanguage, type AppLanguage } from '../../i18n/i18n'

import './styles.css'

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const language: AppLanguage =
    i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN'

  return (
    <Select
      aria-label={t('language.current')}
      className="language-switch"
      size={compact ? 'small' : 'middle'}
      value={language}
      prefix={<GlobalOutlined />}
      onChange={(value: AppLanguage) => void changeAppLanguage(value)}
      options={[
        { value: 'zh-CN', label: t('language.zh') },
        { value: 'en-US', label: t('language.en') },
      ]}
    />
  )
}
