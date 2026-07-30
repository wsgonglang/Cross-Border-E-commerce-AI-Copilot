import { SendOutlined, StopOutlined } from '@ant-design/icons'
import type { AiSessionSummary } from '@cross-border/shared'
import { Alert, Button, Input } from 'antd'

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
  return (
    <div className="ai-chat-input-area">
      {currentSession?.archivedAt ? (
        <Alert
          type="info"
          showIcon
          title="该会话已归档，如需继续对话请先恢复"
        />
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
            placeholder={streaming ? 'AI 正在生成中…' : '输入消息，Enter 发送'}
            disabled={streaming}
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
          {streaming ? (
            <Button
              danger
              aria-label="停止生成"
              icon={<StopOutlined />}
              onClick={onStop}
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              aria-label="发送消息"
              icon={<SendOutlined />}
              onClick={() => void onSend()}
              disabled={!inputValue.trim()}
            >
              发送
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
