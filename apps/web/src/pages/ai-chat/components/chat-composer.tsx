import { SendOutlined, StopOutlined } from '@ant-design/icons'
import type { AiSessionSummary } from '@cross-border/shared'
import { Alert, Button, Checkbox, Input } from 'antd'
import { useTranslation } from 'react-i18next'

const { TextArea } = Input

interface ChatComposerProps {
  currentSession?: AiSessionSummary
  inputValue: string
  onChange: (value: string) => void
  onSend: () => Promise<void>
  onStop: () => void
  streaming: boolean
  canCreateDraft?: boolean
  allowDraftCreation?: boolean
  onAllowDraftCreationChange?: (value: boolean) => void
}

export function ChatComposer({
  currentSession,
  inputValue,
  onChange,
  onSend,
  onStop,
  streaming,
  canCreateDraft = false,
  allowDraftCreation = false,
  onAllowDraftCreationChange,
}: ChatComposerProps) {
  const { t } = useTranslation()

  return (
    <div className="ai-chat-input-area">
      {currentSession?.archivedAt ? (
        <Alert type="info" showIcon title={t('aiChat.composer.archived')} />
      ) : (
        <div>
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
          {canCreateDraft ? (
            <div className="ai-chat-draft-authorization">
              <Checkbox
                checked={allowDraftCreation}
                disabled={streaming}
                onChange={(event) =>
                  onAllowDraftCreationChange?.(event.target.checked)
                }
              >
                {t('aiChat.composer.allowDraftCreation')}
              </Checkbox>
              <span>{t('aiChat.composer.allowDraftCreationHint')}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
