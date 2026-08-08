import type { AiSessionSummary } from '@cross-border/shared'
import { Segmented, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

import type { AiAssistantMode } from '../ai-chat.types'

interface AssistantModeHeaderProps {
  currentSession?: AiSessionSummary
  mode: AiAssistantMode
  onChange: (mode: AiAssistantMode) => void
}

export function AssistantModeHeader({
  currentSession,
  mode,
  onChange,
}: AssistantModeHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="ai-assistant-mode">
      <Segmented
        value={mode}
        onChange={onChange}
        options={[
          { label: t('aiChat.legacyChat'), value: 'chat' },
          { label: t('aiChat.legacyAgent'), value: 'agent' },
        ]}
      />
      {currentSession ? (
        <Typography.Text type="secondary" ellipsis>
          {currentSession.title}
        </Typography.Text>
      ) : null}
    </div>
  )
}
