import type { AiSessionSummary } from '@cross-border/shared'
import { Segmented, Typography } from 'antd'

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
  return (
    <div className="ai-assistant-mode">
      <Segmented
        value={mode}
        onChange={onChange}
        options={[
          { label: '普通对话', value: 'chat' },
          { label: '业务 Agent', value: 'agent' },
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
