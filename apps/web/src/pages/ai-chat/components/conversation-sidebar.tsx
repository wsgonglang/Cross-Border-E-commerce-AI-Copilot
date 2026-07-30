import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderOutlined,
  InboxOutlined,
  MoreOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  SearchOutlined,
  ShareAltOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import type { AiSessionSummary } from '@cross-border/shared'
import {
  Button,
  Dropdown,
  Input,
  List,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'

import type { AiSessionView } from '../ai-chat.types'

interface ConversationSidebarProps {
  currentSessionId: string | null
  groupId?: string
  groupOptions: Array<{ label: string; value: string }>
  keyword: string
  onArchive: (session: AiSessionSummary, archived: boolean) => Promise<void>
  onDelete: (session: AiSessionSummary) => Promise<void>
  onDownload: (
    session: AiSessionSummary,
    format: 'markdown' | 'json',
  ) => Promise<void>
  onEdit: (session: AiSessionSummary) => void
  onGroupChange: (groupId?: string) => void
  onKeywordChange: (keyword: string) => void
  onNew: () => Promise<void>
  onPin: (session: AiSessionSummary) => Promise<void>
  onSelect: (sessionId: string) => void
  onShare: (session: AiSessionSummary) => Promise<void>
  onViewChange: (view: AiSessionView) => void
  sessionView: AiSessionView
  sessions: AiSessionSummary[]
}

export function ConversationSidebar({
  currentSessionId,
  groupId,
  groupOptions,
  keyword,
  onArchive,
  onDelete,
  onDownload,
  onEdit,
  onGroupChange,
  onKeywordChange,
  onNew,
  onPin,
  onSelect,
  onShare,
  onViewChange,
  sessionView,
  sessions,
}: ConversationSidebarProps) {
  const confirmDelete = (session: AiSessionSummary) => {
    Modal.confirm({
      title: '永久删除该会话？',
      content: '此操作只允许用于已归档会话，且无法恢复。',
      okText: '永久删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => onDelete(session),
    })
  }

  const sessionActions = (session: AiSessionSummary) => [
    {
      key: 'rename',
      label: '重命名与分组',
      icon: <EditOutlined />,
      onClick: () => onEdit(session),
    },
    {
      key: 'pin',
      label: session.pinned ? '取消置顶' : '置顶会话',
      icon: session.pinned ? <PushpinFilled /> : <PushpinOutlined />,
      onClick: () => void onPin(session),
    },
    {
      key: 'share',
      label: '内部分享',
      icon: <ShareAltOutlined />,
      disabled: Boolean(session.archivedAt),
      onClick: () => void onShare(session),
    },
    {
      key: 'markdown',
      label: '导出 Markdown',
      icon: <DownloadOutlined />,
      onClick: () => void onDownload(session, 'markdown'),
    },
    {
      key: 'json',
      label: '导出 JSON',
      icon: <DownloadOutlined />,
      onClick: () => void onDownload(session, 'json'),
    },
    {
      key: 'archive',
      label: session.archivedAt ? '恢复会话' : '归档会话',
      icon: session.archivedAt ? <UndoOutlined /> : <InboxOutlined />,
      onClick: () => void onArchive(session, !session.archivedAt),
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

  return (
    <aside className="ai-chat-sidebar">
      <div className="ai-chat-sidebar-header">
        <Button
          type="primary"
          block
          icon={<PlusOutlined />}
          onClick={() => void onNew()}
        >
          新建对话
        </Button>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
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
            onChange={onViewChange}
          />
        </Space.Compact>
        <Select
          allowClear
          value={groupId}
          options={groupOptions}
          onChange={onGroupChange}
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
                session.id === currentSessionId ? 'ai-chat-session-active' : ''
              }
              onClick={() => onSelect(session.id)}
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
  )
}
