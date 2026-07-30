import type { AiMessage } from '@cross-border/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ChatMessageList } from './chat-message-list'

const message: AiMessage = {
  id: 'message-1',
  sessionId: 'session-1',
  role: 'assistant',
  content: '已完成商品分析',
  childrenIds: [],
  favorited: false,
  links: [
    {
      id: 'link-1',
      entityType: 'PRODUCT',
      entityId: 'product-1',
      entityCode: 'P-DEMO-001',
      entityLabel: '便携式充电器',
      createdAt: '2026-07-30T00:00:00.000Z',
    },
  ],
  createdAt: '2026-07-30T00:00:00.000Z',
}

function renderList(
  item: AiMessage,
  callbacks?: {
    onFavorite?: (message: AiMessage) => Promise<void>
    onLink?: (message: AiMessage) => void
    onBusinessNavigate?: (
      entityType: 'PRODUCT' | 'ORDER',
      entityCode: string,
    ) => void
  },
) {
  return render(
    <ChatMessageList
      currentSessionId="session-1"
      sessionView="active"
      messages={[item]}
      error={null}
      endRef={createRef<HTMLDivElement>()}
      onClearError={vi.fn()}
      onFavorite={callbacks?.onFavorite ?? vi.fn()}
      onLink={callbacks?.onLink ?? vi.fn()}
      onBusinessNavigate={callbacks?.onBusinessNavigate ?? vi.fn()}
    />,
  )
}

describe('ChatMessageList', () => {
  it('keeps favorite and business-link actions on persisted messages', () => {
    const onFavorite = vi.fn().mockResolvedValue(undefined)
    const onLink = vi.fn()
    renderList(message, { onFavorite, onLink })

    fireEvent.click(screen.getByRole('button', { name: '收藏消息' }))
    fireEvent.click(screen.getByRole('button', { name: '关联业务' }))

    expect(onFavorite).toHaveBeenCalledWith(message)
    expect(onLink).toHaveBeenCalledWith(message)
  })

  it('navigates from an existing business association', () => {
    const onBusinessNavigate = vi.fn()
    renderList(message, { onBusinessNavigate })

    fireEvent.click(screen.getByRole('button', { name: 'link 便携式充电器' }))
    expect(onBusinessNavigate).toHaveBeenCalledWith('PRODUCT', 'P-DEMO-001')
  })

  it('hides persistence actions for optimistic streaming messages', () => {
    renderList({
      ...message,
      id: 'optimistic-assistant-1',
      content: '',
      links: [],
    })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('思考中…')).toBeInTheDocument()
  })
})
