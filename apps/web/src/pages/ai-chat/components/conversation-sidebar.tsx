import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderOutlined,
  InboxOutlined,
  LoadingOutlined,
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
} from 'antd'
import { useTranslation } from 'react-i18next'

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
  streamingSessionIds: string[]
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
  streamingSessionIds,
}: ConversationSidebarProps) {
  const { t } = useTranslation()

  const confirmDelete = (session: AiSessionSummary) => {
    Modal.confirm({
      title: t('aiChat.sidebar.deleteTitle'),
      content: t('aiChat.sidebar.deleteDescription'),
      okText: t('aiChat.sidebar.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: () => onDelete(session),
    })
  }

  const sessionActions = (session: AiSessionSummary) => [
    {
      key: 'rename',
      label: t('aiChat.sidebar.rename'),
      icon: <EditOutlined />,
      onClick: () => onEdit(session),
    },
    {
      key: 'pin',
      label: session.pinned
        ? t('aiChat.sidebar.unpin')
        : t('aiChat.sidebar.pin'),
      icon: session.pinned ? <PushpinFilled /> : <PushpinOutlined />,
      onClick: () => void onPin(session),
    },
    {
      key: 'share',
      label: t('aiChat.sidebar.share'),
      icon: <ShareAltOutlined />,
      disabled: Boolean(session.archivedAt),
      onClick: () => void onShare(session),
    },
    {
      key: 'markdown',
      label: t('aiChat.sidebar.exportMarkdown'),
      icon: <DownloadOutlined />,
      onClick: () => void onDownload(session, 'markdown'),
    },
    {
      key: 'json',
      label: t('aiChat.sidebar.exportJson'),
      icon: <DownloadOutlined />,
      onClick: () => void onDownload(session, 'json'),
    },
    {
      key: 'archive',
      label: session.archivedAt
        ? t('aiChat.sidebar.restore')
        : t('aiChat.sidebar.archive'),
      icon: session.archivedAt ? <UndoOutlined /> : <InboxOutlined />,
      onClick: () => void onArchive(session, !session.archivedAt),
    },
    ...(session.archivedAt
      ? [
          {
            key: 'delete',
            label: t('aiChat.sidebar.delete'),
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
          {t('aiChat.sidebar.new')}
        </Button>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder={t('aiChat.sidebar.search')}
        />
        <Space.Compact block>
          <Segmented
            block
            value={sessionView}
            options={[
              { label: t('aiChat.sidebar.active'), value: 'active' },
              { label: t('aiChat.sidebar.archived'), value: 'archived' },
            ]}
            onChange={onViewChange}
          />
        </Space.Compact>
        <Select
          allowClear
          value={groupId}
          options={groupOptions}
          onChange={onGroupChange}
          placeholder={t('aiChat.sidebar.allGroups')}
          suffixIcon={<FolderOutlined />}
        />
      </div>
      <div className="ai-chat-session-list">
        <List
          dataSource={sessions}
          locale={{ emptyText: t('aiChat.sidebar.empty') }}
          renderItem={(session) => (
            <List.Item
              key={session.id}
              className={
                session.id === currentSessionId ? 'ai-chat-session-active' : ''
              }
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
                    aria-label={t('aiChat.sidebar.manage', {
                      title: session.title,
                    })}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                </Dropdown>,
              ]}
            >
              <button
                type="button"
                className="ai-chat-session-select"
                onClick={() => onSelect(session.id)}
                aria-current={
                  session.id === currentSessionId ? 'true' : undefined
                }
              >
                <span className="ai-chat-session-title-row">
                  {session.pinned ? (
                    <PushpinFilled className="session-pin" />
                  ) : null}
                  {streamingSessionIds.includes(session.id) ? (
                    <LoadingOutlined
                      spin
                      className="session-streaming"
                      aria-label={t('aiChat.sidebar.generating', {
                        title: session.title,
                      })}
                    />
                  ) : null}
                  <span className="session-title" title={session.title}>
                    {session.title}
                  </span>
                </span>
                <span className="ai-chat-session-meta-row">
                  <span>
                    {t('aiChat.sidebar.messageCount', {
                      count: session.messageCount,
                    })}
                  </span>
                  {session.groupId ? <Tag>{session.groupId}</Tag> : null}
                </span>
              </button>
            </List.Item>
          )}
        />
      </div>
    </aside>
  )
}
