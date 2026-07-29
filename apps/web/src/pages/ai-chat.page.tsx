import type {
  AiMessage,
  AiMessageLinkType,
  AiShareCandidate,
  AiSessionShareSummary,
  AiSessionSummary,
} from '@cross-border/shared'
import {
  Alert,
  Avatar,
  Button,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message as antMessage,
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderOutlined,
  HeartFilled,
  HeartOutlined,
  InboxOutlined,
  LinkOutlined,
  MoreOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  SearchOutlined,
  SendOutlined,
  ShareAltOutlined,
  StopOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  createAiSession,
  createAiSessionShare,
  deleteAiSession,
  downloadAiSession,
  favoriteAiMessage,
  getAiSession,
  getAiShareCandidates,
  linkAiMessage,
  listAiSessions,
  listAiSessionShares,
  revokeAiSessionShare,
  setAiSessionArchived,
  updateAiSession,
} from '../api/ai'
import { AgentPanel } from '../components/agent-panel'
import { useBusinessContext } from '../contexts/business-context'
import { useAppSelector } from '../store/hooks'

const { TextArea } = Input

interface SessionFormValues {
  title: string
  groupId?: string
}

interface LinkFormValues {
  entityType: AiMessageLinkType
  entityReference: string
}

interface ShareFormValues {
  recipientUserIds: string[]
  expiresInHours: number
}

function doSend(input: {
  token: string
  merchantId: string
  sessionId: string
  text: string
  parentMessageId?: string
  setMessages: React.Dispatch<React.SetStateAction<AiMessage[]>>
  setStreaming: React.Dispatch<React.SetStateAction<boolean>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  abortRef: React.MutableRefObject<AbortController | null>
  onComplete: () => Promise<void>
}) {
  const userMessageId = `optimistic-user-${Date.now()}`
  const assistantId = `optimistic-assistant-${Date.now()}`
  input.setMessages((previous) => [
    ...previous,
    {
      id: userMessageId,
      sessionId: input.sessionId,
      role: 'user',
      content: input.text,
      childrenIds: [],
      links: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: assistantId,
      sessionId: input.sessionId,
      role: 'assistant',
      content: '',
      childrenIds: [],
      links: [],
      createdAt: new Date().toISOString(),
    },
  ])
  input.setStreaming(true)
  const controller = new AbortController()
  input.abortRef.current = controller

  void fetch(`/api/merchants/${input.merchantId}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.token}`,
    },
    body: JSON.stringify({
      content: input.text,
      sessionId: input.sessionId,
      parentMessageId: input.parentMessageId,
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`请求失败：${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('当前浏览器不支持流式响应')
      const decoder = new TextDecoder('utf-8')
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        input.setMessages((previous) =>
          previous.map((item) =>
            item.id === assistantId
              ? { ...item, content: item.content + chunk }
              : item,
          ),
        )
      }
    })
    .catch((error: Error) => {
      if (error.name !== 'AbortError') input.setError(error.message)
    })
    .finally(() => {
      input.setStreaming(false)
      input.abortRef.current = null
      void input.onComplete()
    })
}

export function AiChatPage() {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const user = useAppSelector((state) => state.auth.user)
  const { merchantId, storeId, currentStore } = useBusinessContext()
  const navigate = useNavigate()
  const [messageApi, messageContext] = antMessage.useMessage()

  const [sessions, setSessions] = useState<AiSessionSummary[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [sessionView, setSessionView] = useState<'active' | 'archived'>(
    'active',
  )
  const [keyword, setKeyword] = useState('')
  const [groupId, setGroupId] = useState<string>()
  const [knownGroups, setKnownGroups] = useState<string[]>([])
  const [streaming, setStreaming] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [assistantMode, setAssistantMode] = useState<'chat' | 'agent'>('chat')
  const [editingSession, setEditingSession] = useState<AiSessionSummary | null>(
    null,
  )
  const [linkingMessage, setLinkingMessage] = useState<AiMessage | null>(null)
  const [sharingSession, setSharingSession] = useState<AiSessionSummary | null>(
    null,
  )
  const [shareCandidates, setShareCandidates] = useState<AiShareCandidate[]>([])
  const [shares, setShares] = useState<AiSessionShareSummary[]>([])
  const [sessionForm] = Form.useForm<SessionFormValues>()
  const [linkForm] = Form.useForm<LinkFormValues>()
  const [shareForm] = Form.useForm<ShareFormValues>()
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadSessions = useCallback(async () => {
    if (!token || !merchantId) return
    const result = await listAiSessions(token, merchantId, {
      keyword: keyword.trim() || undefined,
      archived: sessionView === 'archived',
      groupId,
    })
    setSessions(result.items)
    setKnownGroups((current) =>
      Array.from(
        new Set([
          ...current,
          ...result.items.flatMap((session) =>
            session.groupId ? [session.groupId] : [],
          ),
        ]),
      ).sort(),
    )
    setCurrentSessionId((current) => {
      if (result.items.some((session) => session.id === current)) return current
      return result.items[0]?.id ?? null
    })
    if (result.items.length === 0) setMessages([])
  }, [groupId, keyword, merchantId, sessionView, token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSessions().catch((loadError: Error) =>
        setError(loadError.message),
      )
    }, 250)
    return () => window.clearTimeout(timer)
  }, [loadSessions])

  const loadCurrentSession = useCallback(async () => {
    if (!currentSessionId || !token || !merchantId) return
    const session = await getAiSession(token, merchantId, currentSessionId)
    setMessages(session.messages)
    setSessions((current) =>
      current.map((item) =>
        item.id === session.id
          ? {
              ...item,
              title: session.title,
              messageCount: session.messageCount,
            }
          : item,
      ),
    )
  }, [currentSessionId, merchantId, token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCurrentSession().catch((loadError: Error) =>
        setError(loadError.message),
      )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCurrentSession])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const currentSession = sessions.find(
    (session) => session.id === currentSessionId,
  )

  const handleNewSession = useCallback(async () => {
    if (!token || !merchantId) return
    try {
      const session = await createAiSession(token, merchantId, 'AI 对话')
      setSessionView('active')
      setSessions((previous) => [session, ...previous])
      setCurrentSessionId(session.id)
      setMessages([])
    } catch (createError: unknown) {
      setError(
        createError instanceof Error ? createError.message : '创建会话失败',
      )
    }
  }, [merchantId, token])

  const updateSession = async (
    session: AiSessionSummary,
    data: { title?: string; pinned?: boolean; groupId?: string },
  ) => {
    const updated = await updateAiSession(token, merchantId, session.id, data)
    setSessions((current) =>
      current
        .map((item) => (item.id === updated.id ? updated : item))
        .sort(
          (first, second) =>
            Number(second.pinned) - Number(first.pinned) ||
            second.updatedAt.localeCompare(first.updatedAt),
        ),
    )
  }

  const saveSessionEdit = async () => {
    if (!editingSession) return
    const values = await sessionForm.validateFields()
    await updateSession(editingSession, {
      title: values.title,
      groupId: values.groupId ?? '',
    })
    setEditingSession(null)
    messageApi.success('会话信息已更新')
  }

  const archiveSession = async (
    session: AiSessionSummary,
    archived: boolean,
  ) => {
    await setAiSessionArchived(token, merchantId, session.id, archived)
    await loadSessions()
    messageApi.success(archived ? '会话已归档' : '会话已恢复')
  }

  const confirmDelete = (session: AiSessionSummary) => {
    Modal.confirm({
      title: '永久删除该会话？',
      content: '此操作只允许用于已归档会话，且无法恢复。',
      okText: '永久删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteAiSession(token, merchantId, session.id)
        await loadSessions()
      },
    })
  }

  const openShare = async (session: AiSessionSummary) => {
    setSharingSession(session)
    shareForm.setFieldsValue({ expiresInHours: 24, recipientUserIds: [] })
    const [candidates, records] = await Promise.all([
      getAiShareCandidates(token, merchantId),
      listAiSessionShares(token, merchantId, session.id),
    ])
    setShareCandidates(candidates)
    setShares(records)
  }

  const createShare = async () => {
    if (!sharingSession) return
    const values = await shareForm.validateFields()
    const created = await createAiSessionShare(
      token,
      merchantId,
      sharingSession.id,
      values.recipientUserIds,
      values.expiresInHours,
    )
    setShares((current) => [created, ...current])
    shareForm.setFieldValue('recipientUserIds', [])
    messageApi.success('内部只读分享已创建')
  }

  const copyShareLink = async (shareId: string) => {
    const url = `${window.location.origin}/ai-shares/${shareId}?merchantId=${merchantId}`
    await navigator.clipboard.writeText(url)
    messageApi.success('分享链接已复制')
  }

  const handleFavorite = async (item: AiMessage) => {
    if (!currentSessionId || item.id.startsWith('optimistic-')) return
    const updated = await favoriteAiMessage(
      token,
      merchantId,
      currentSessionId,
      item.id,
      !item.favorited,
    )
    setMessages((current) =>
      current.map((message) => (message.id === updated.id ? updated : message)),
    )
  }

  const saveMessageLink = async () => {
    if (!linkingMessage || !currentSessionId) return
    const values = await linkForm.validateFields()
    const link = await linkAiMessage(
      token,
      merchantId,
      currentSessionId,
      linkingMessage.id,
      values,
    )
    setMessages((current) =>
      current.map((item) =>
        item.id === linkingMessage.id
          ? {
              ...item,
              links: [
                ...item.links.filter(
                  (currentLink) => currentLink.id !== link.id,
                ),
                link,
              ],
            }
          : item,
      ),
    )
    setLinkingMessage(null)
    linkForm.resetFields()
    messageApi.success('消息已关联业务对象')
  }

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text || !token || !merchantId || streaming) return
    setInputValue('')
    setError(null)
    const send = (sessionId: string) => {
      const parentMessageId = [...messages]
        .reverse()
        .find((item) => !item.id.startsWith('optimistic-'))?.id
      doSend({
        token,
        merchantId,
        sessionId,
        text,
        parentMessageId,
        setMessages,
        setStreaming,
        setError,
        abortRef,
        onComplete: async () => {
          const session = await getAiSession(token, merchantId, sessionId)
          setMessages(session.messages)
          await loadSessions()
        },
      })
    }
    if (currentSessionId) {
      send(currentSessionId)
      return
    }
    void createAiSession(token, merchantId, 'AI 对话')
      .then((session) => {
        setSessions((previous) => [session, ...previous])
        setCurrentSessionId(session.id)
        send(session.id)
      })
      .catch((createError: Error) => setError(createError.message))
  }, [
    currentSessionId,
    inputValue,
    loadSessions,
    merchantId,
    messages,
    streaming,
    token,
  ])

  const sessionActions = (session: AiSessionSummary) => [
    {
      key: 'rename',
      label: '重命名与分组',
      icon: <EditOutlined />,
      onClick: () => {
        setEditingSession(session)
        sessionForm.setFieldsValue({
          title: session.title,
          groupId: session.groupId,
        })
      },
    },
    {
      key: 'pin',
      label: session.pinned ? '取消置顶' : '置顶会话',
      icon: session.pinned ? <PushpinFilled /> : <PushpinOutlined />,
      onClick: () => void updateSession(session, { pinned: !session.pinned }),
    },
    {
      key: 'share',
      label: '内部分享',
      icon: <ShareAltOutlined />,
      disabled: Boolean(session.archivedAt),
      onClick: () =>
        void openShare(session).catch((shareError: Error) =>
          setError(shareError.message),
        ),
    },
    {
      key: 'markdown',
      label: '导出 Markdown',
      icon: <DownloadOutlined />,
      onClick: () =>
        void downloadAiSession(token, merchantId, session.id, 'markdown'),
    },
    {
      key: 'json',
      label: '导出 JSON',
      icon: <DownloadOutlined />,
      onClick: () =>
        void downloadAiSession(token, merchantId, session.id, 'json'),
    },
    {
      key: 'archive',
      label: session.archivedAt ? '恢复会话' : '归档会话',
      icon: session.archivedAt ? <UndoOutlined /> : <InboxOutlined />,
      onClick: () => void archiveSession(session, !session.archivedAt),
    },
    ...(session.archivedAt
      ? [
          {
            key: 'delete',
            label: '永久删除',
            danger: true,
            icon: <DeleteOutlined />,
            onClick: () => confirmDelete(session),
          },
        ]
      : []),
  ]

  const groupOptions = useMemo(
    () => knownGroups.map((value) => ({ label: value, value })),
    [knownGroups],
  )

  return (
    <div className="ai-chat-layout">
      {messageContext}
      <aside className="ai-chat-sidebar">
        <div className="ai-chat-sidebar-header">
          <Button
            type="primary"
            block
            icon={<PlusOutlined />}
            onClick={() => void handleNewSession()}
          >
            新建对话
          </Button>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题或消息内容"
          />
          <Space.Compact block>
            <Segmented
              block
              value={sessionView}
              options={[
                { label: '进行中', value: 'active' },
                { label: '已归档', value: 'archived' },
              ]}
              onChange={(value) =>
                setSessionView(value as 'active' | 'archived')
              }
            />
          </Space.Compact>
          <Select
            allowClear
            value={groupId}
            options={groupOptions}
            onChange={setGroupId}
            placeholder="全部分组"
            suffixIcon={<FolderOutlined />}
          />
        </div>
        <div className="ai-chat-session-list">
          <List
            dataSource={sessions}
            locale={{ emptyText: '暂无匹配会话' }}
            renderItem={(session) => (
              <List.Item
                key={session.id}
                className={
                  session.id === currentSessionId
                    ? 'ai-chat-session-active'
                    : ''
                }
                onClick={() => {
                  setCurrentSessionId(session.id)
                  setError(null)
                }}
                actions={[
                  <Dropdown
                    key="more"
                    trigger={['click']}
                    menu={{ items: sessionActions(session) }}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreOutlined />}
                      aria-label={`管理会话 ${session.title}`}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </Dropdown>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={4}>
                      {session.pinned ? (
                        <PushpinFilled className="session-pin" />
                      ) : null}
                      <Typography.Text ellipsis className="session-title">
                        {session.title}
                      </Typography.Text>
                    </Space>
                  }
                  description={
                    <Space size={4} wrap>
                      <span>{session.messageCount} 条消息</span>
                      {session.groupId ? <Tag>{session.groupId}</Tag> : null}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </aside>

      <div className="ai-chat-main">
        <div className="ai-assistant-mode">
          <Segmented
            value={assistantMode}
            onChange={setAssistantMode}
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
        {assistantMode === 'agent' ? (
          <AgentPanel
            token={token}
            merchantId={merchantId}
            storeId={storeId || undefined}
            storeName={currentStore?.name}
            sourcePage="ai-chat"
            canWrite={
              user?.roles.some((role) =>
                ['admin', 'operator'].includes(role),
              ) ?? false
            }
          />
        ) : (
          <>
            <div className="ai-chat-messages">
              {error ? (
                <Alert
                  type="error"
                  title={error}
                  closable
                  onClose={() => setError(null)}
                />
              ) : null}
              {!currentSessionId ? (
                <Empty
                  description={
                    sessionView === 'archived'
                      ? '没有已归档会话'
                      : '新建或选择一个会话开始协作'
                  }
                />
              ) : null}
              {messages.map((item) => (
                <div
                  key={item.id}
                  className={`ai-chat-message ${
                    item.role === 'user'
                      ? 'ai-chat-message-user'
                      : 'ai-chat-message-ai'
                  }`}
                >
                  <Avatar
                    className="ai-chat-avatar"
                    size={32}
                    style={{
                      background: item.role === 'user' ? '#0f766e' : '#0891b2',
                    }}
                  >
                    {item.role === 'user' ? 'U' : 'AI'}
                  </Avatar>
                  <div className="ai-chat-message-content">
                    <div className="ai-chat-bubble">
                      {item.content || (
                        <span className="ai-chat-thinking">思考中…</span>
                      )}
                    </div>
                    {!item.id.startsWith('optimistic-') ? (
                      <Space size={4} className="ai-message-actions">
                        <Tooltip
                          title={item.favorited ? '取消收藏' : '收藏消息'}
                        >
                          <Button
                            type="text"
                            size="small"
                            aria-label={
                              item.favorited ? '取消收藏消息' : '收藏消息'
                            }
                            icon={
                              item.favorited ? (
                                <HeartFilled className="favorite-active" />
                              ) : (
                                <HeartOutlined />
                              )
                            }
                            onClick={() => void handleFavorite(item)}
                          />
                        </Tooltip>
                        <Button
                          type="text"
                          size="small"
                          icon={<LinkOutlined />}
                          onClick={() => {
                            setLinkingMessage(item)
                            linkForm.setFieldsValue({
                              entityType: 'PRODUCT',
                              entityReference: '',
                            })
                          }}
                        >
                          关联业务
                        </Button>
                      </Space>
                    ) : null}
                    {item.links.length ? (
                      <Space wrap className="message-business-links">
                        {item.links.map((link) => (
                          <Button
                            key={link.id}
                            size="small"
                            icon={<LinkOutlined />}
                            onClick={() =>
                              void navigate(
                                link.entityType === 'PRODUCT'
                                  ? `/products?keyword=${encodeURIComponent(link.entityCode)}`
                                  : `/orders?keyword=${encodeURIComponent(link.entityCode)}`,
                              )
                            }
                          >
                            {link.entityLabel}
                          </Button>
                        ))}
                      </Space>
                    ) : null}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

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
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={
                      streaming ? 'AI 正在生成中…' : '输入消息，Enter 发送'
                    }
                    disabled={streaming}
                    autoSize={{ minRows: 2, maxRows: 6 }}
                  />
                  {streaming ? (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={() => abortRef.current?.abort()}
                    >
                      停止
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={handleSend}
                      disabled={!inputValue.trim()}
                    >
                      发送
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        open={Boolean(editingSession)}
        title="重命名与分组"
        okText="保存"
        cancelText="取消"
        onOk={() => void saveSessionEdit()}
        onCancel={() => setEditingSession(null)}
      >
        <Form form={sessionForm} layout="vertical">
          <Form.Item
            name="title"
            label="会话名称"
            rules={[{ required: true, max: 255 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="groupId" label="分组">
            <Select
              allowClear
              showSearch
              options={groupOptions}
              placeholder="选择或输入分组名称"
              popupRender={(menu) => (
                <>
                  {menu}
                  <Input
                    placeholder="输入新分组后按 Enter"
                    onPressEnter={(event) => {
                      const value = event.currentTarget.value
                        .trim()
                        .slice(0, 30)
                      if (value) {
                        setKnownGroups((current) =>
                          Array.from(new Set([...current, value])).sort(),
                        )
                        sessionForm.setFieldValue('groupId', value)
                        event.currentTarget.value = ''
                      }
                    }}
                  />
                </>
              )}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(linkingMessage)}
        title="关联业务对象"
        okText="关联"
        cancelText="取消"
        onOk={() => void saveMessageLink()}
        onCancel={() => setLinkingMessage(null)}
      >
        <Alert
          type="info"
          showIcon
          title="使用业务编号关联，服务端会验证当前商家范围"
        />
        <Form form={linkForm} layout="vertical" className="modal-form">
          <Form.Item
            name="entityType"
            label="对象类型"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: '商品', value: 'PRODUCT' },
                { label: '订单', value: 'ORDER' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="entityReference"
            label="商品编码或订单号"
            rules={[{ required: true, max: 64 }]}
          >
            <Input placeholder="例如 P-DEMO-001 或 ORD-20260701-001" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        width={720}
        open={Boolean(sharingSession)}
        title="内部只读分享"
        footer={null}
        onCancel={() => setSharingSession(null)}
      >
        <Alert
          type="warning"
          showIcon
          title="仅当前商家的指定登录用户可访问"
          description="分享保存创建时的脱敏快照，不会随原会话后续修改；到期或撤销后立即失效。"
        />
        <Form form={shareForm} layout="vertical" className="modal-form">
          <Form.Item
            name="recipientUserIds"
            label="授权同事"
            rules={[{ required: true, message: '请选择至少一位同事' }]}
          >
            <Select
              mode="multiple"
              options={shareCandidates.map((candidate) => ({
                label: `${candidate.name} · ${candidate.email}`,
                value: candidate.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="expiresInHours"
            label="有效期"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: '1 小时', value: 1 },
                { label: '24 小时', value: 24 },
                { label: '3 天', value: 72 },
                { label: '7 天', value: 168 },
              ]}
            />
          </Form.Item>
          <Button
            type="primary"
            icon={<ShareAltOutlined />}
            onClick={() => void createShare()}
          >
            创建分享快照
          </Button>
        </Form>
        <List
          header="已创建分享"
          locale={{ emptyText: '暂无分享' }}
          dataSource={shares}
          renderItem={(share) => (
            <List.Item
              actions={
                share.revokedAt
                  ? []
                  : [
                      <Button
                        key="copy"
                        type="link"
                        onClick={() => void copyShareLink(share.id)}
                      >
                        复制链接
                      </Button>,
                      <Button
                        key="revoke"
                        type="link"
                        danger
                        onClick={() =>
                          void revokeAiSessionShare(
                            token,
                            merchantId,
                            share.id,
                          ).then((updated) =>
                            setShares((current) =>
                              current.map((item) =>
                                item.id === updated.id ? updated : item,
                              ),
                            ),
                          )
                        }
                      >
                        撤销
                      </Button>,
                    ]
              }
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>{share.recipientCount} 位收件人</span>
                    {share.revokedAt ? <Tag color="red">已撤销</Tag> : null}
                  </Space>
                }
                description={`有效期至 ${new Date(share.expiresAt).toLocaleString('zh-CN')}`}
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  )
}
