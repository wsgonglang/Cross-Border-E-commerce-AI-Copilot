import {
  Alert,
  Avatar,
  Button,
  Input,
  List,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { AiMessage, AiSessionSummary } from '@cross-border/shared'

import {
  createAiSession,
  deleteAiSession,
  getAiSession,
  listAiSessions,
} from '../api/ai'
import { useAppSelector } from '../store/hooks'

const { TextArea } = Input

function doSend(
  tk: string,
  mid: string,
  sid: string,
  text: string,
  setMessages: React.Dispatch<React.SetStateAction<AiMessage[]>>,
  setStreaming: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  abortRef: React.MutableRefObject<AbortController | null>,
) {
  const userMsgId = `user-${Date.now()}`
  setMessages((prev) => [
    ...prev,
    {
      id: userMsgId,
      sessionId: sid,
      role: 'user',
      content: text,
      childrenIds: [],
      createdAt: new Date().toISOString(),
    },
  ])

  const assistantId = `assistant-${Date.now()}`
  setMessages((prev) => [
    ...prev,
    {
      id: assistantId,
      sessionId: sid,
      role: 'assistant',
      content: '',
      childrenIds: [],
      createdAt: new Date().toISOString(),
    },
  ])

  setStreaming(true)
  const controller = new AbortController()
  abortRef.current = controller

  fetch(`/api/merchants/${mid}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tk}`,
    },
    body: JSON.stringify({
      content: text,
      sessionId: sid,
      parentMessageId: userMsgId,
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('ReadableStream not supported')
      }
      const decoder = new TextDecoder('utf-8')
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + chunk }
              : m,
          ),
        )
      }
    })
    .catch((err: Error) => {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + '\n\n[已停止]' }
              : m,
          ),
        )
      } else {
        setError(err.message)
      }
    })
    .finally(() => {
      setStreaming(false)
      abortRef.current = null
    })
}

export function AiChatPage() {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const user = useAppSelector((state) => state.auth.user)
  const merchantId = user?.merchantIds[0] ?? ''

  const [sessions, setSessions] = useState<AiSessionSummary[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load sessions
  useEffect(() => {
    if (!token || !merchantId) return
    listAiSessions(token, merchantId)
      .then((res) => {
        setSessions(res.items)
        if (res.items.length > 0) {
          setCurrentSessionId(res.items[0]!.id)
        }
      })
      .catch((e: Error) => setError(e.message))
  }, [token, merchantId])

  // Load messages when sessionId changes
  useEffect(() => {
    if (!currentSessionId || !token || !merchantId) return
    getAiSession(token, merchantId, currentSessionId)
      .then((session) => {
        setMessages(session.messages)
      })
      .catch((e: Error) => setError(e.message))
  }, [currentSessionId, token, merchantId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleNewSession = useCallback(() => {
    if (!token || !merchantId) return
    createAiSession(token, merchantId, 'AI 对话')
      .then((session) => {
        setSessions((prev) => [session, ...prev])
        setCurrentSessionId(session.id)
        setMessages([])
      })
      .catch((e: Error) => setError(e.message))
  }, [token, merchantId])

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      if (!token || !merchantId) return
      deleteAiSession(token, merchantId, sessionId)
        .then(() => {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId))
          if (currentSessionId === sessionId) {
            setCurrentSessionId(null)
          }
        })
        .catch((e: Error) => setError(e.message))
    },
    [token, merchantId, currentSessionId],
  )

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text || !token || !merchantId || streaming) return

    setInputValue('')
    setError(null)

    if (!currentSessionId) {
      createAiSession(token, merchantId, 'AI 对话')
        .then((session) => {
          setSessions((prev) => [session, ...prev])
          setCurrentSessionId(session.id)
          doSend(token, merchantId, session.id, text, setMessages, setStreaming, setError, abortRef)
        })
        .catch((e: Error) => setError(e.message))
      return
    }

    doSend(token, merchantId, currentSessionId, text, setMessages, setStreaming, setError, abortRef)
  }, [inputValue, token, merchantId, streaming, currentSessionId])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="ai-chat-layout">
      <aside className="ai-chat-sidebar">
        <div className="ai-chat-sidebar-header">
          <Button type="primary" block icon={<PlusOutlined />} onClick={handleNewSession}>
            新建对话
          </Button>
        </div>
        <div className="ai-chat-session-list">
          <List
            dataSource={sessions}
            locale={{ emptyText: '暂无对话' }}
            renderItem={(session) => (
              <List.Item
                key={session.id}
                className={session.id === currentSessionId ? 'ai-chat-session-active' : ''}
                onClick={() => { setCurrentSessionId(session.id); setError(null) }}
                actions={[
                  <Button key="delete" type="text" size="small" danger icon={<DeleteOutlined />}
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id) }}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={<Typography.Text ellipsis style={{ maxWidth: 160 }}>{session.title}</Typography.Text>}
                  description={`${session.messageCount} 条消息`}
                />
              </List.Item>
            )}
          />
        </div>
      </aside>

      <div className="ai-chat-main">
        <div className="ai-chat-messages">
          {error ? (
            <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ margin: 12 }} />
          ) : null}
          {!currentSessionId && (
            <div className="ai-chat-empty">
              <h2>AI 运营助手</h2>
              <p>选择或创建一个对话，开始 AI 辅助运营</p>
            </div>
          )}
          {messages.map((msg) => (
              <div key={msg.id} className={`ai-chat-message ${msg.role === 'user' ? 'ai-chat-message-user' : 'ai-chat-message-ai'}`}>
                <Avatar className="ai-chat-avatar" size={32}
                  style={msg.role === 'user' ? { background: '#0f766e' } : { background: '#0891b2' }}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </Avatar>
                <div className="ai-chat-bubble">
                  {msg.content || <span className="ai-chat-thinking">思考中…</span>}
                </div>
              </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="ai-chat-input-area">
          <div className="ai-chat-input-row">
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={streaming ? 'AI 正在生成中…' : '输入消息，Enter 发送'}
              disabled={streaming}
              autoSize={{ minRows: 2, maxRows: 6 }}
              style={{ flex: 1 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {streaming ? (
                <Button danger icon={<StopOutlined />} onClick={handleStop}>停止</Button>
              ) : (
                <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!inputValue.trim()}>发送</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
