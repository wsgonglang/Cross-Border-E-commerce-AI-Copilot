import { SendOutlined, StopOutlined } from '@ant-design/icons'
import type { AiSessionSummary } from '@cross-border/shared'
import { Alert, Button, Input } from 'antd'
import { useTranslation } from 'react-i18next'

const { TextArea } = Input

interface ChatComposerProps {
  currentSession?: AiSessionSummary
  inputValue: string
  onChange: (value: string) => void
  onSend: () => Promise<void>
  onStop: () => void
  streaming: boolean
}

export function ChatComposer({
  currentSession,
  inputValue,
  onChange,
  onSend,
  onStop,
  streaming,
}: ChatComposerProps) {
  const { t } = useTranslation()

  return (
    <div className="ai-chat-input-area">
      {currentSession?.archivedAt ? (
        <Alert type="info" showIcon title={t('aiChat.composer.archived')} />
      ) : (
        <div className="ai-chat-input-row">
          <TextArea
            value={inputValue}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void onSend()
              }
            }}
            placeholder={
              streaming
                ? t('aiChat.composer.generating')
                : t('aiChat.composer.placeholder')
            }
            disabled={streaming}
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
          {streaming ? (
            <Button
              danger
              aria-label={t('aiChat.composer.stopLabel')}
              icon={<StopOutlined />}
              onClick={onStop}
            >
              {t('aiChat.composer.stop')}
            </Button>
          ) : (
            <Button
              type="primary"
              aria-label={t('aiChat.composer.sendLabel')}
              icon={<SendOutlined />}
              onClick={() => void onSend()}
              disabled={!inputValue.trim()}
            >
              {t('aiChat.composer.send')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
