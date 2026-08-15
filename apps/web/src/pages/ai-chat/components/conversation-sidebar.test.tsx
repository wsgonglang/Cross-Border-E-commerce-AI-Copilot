import type { AiSessionSummary } from '@cross-border/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConversationSidebar } from './conversation-sidebar'

function session(): AiSessionSummary {
  return {
    id: 'session-1',
    merchantId: 'merchant-1',
    userId: 'user-1',
    title: '库存分析会话',
    status: 'done',
    pinned: true,
    groupId: '库存',
    messageCount: 3,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T09:00:00.000Z',
  }
}

function renderSidebar(onSelect = vi.fn()) {
  render(
    <ConversationSidebar
      currentSessionId="session-1"
      groupOptions={[]}
      keyword=""
      onArchive={vi.fn()}
      onDelete={vi.fn()}
      onDownload={vi.fn()}
      onEdit={vi.fn()}
      onGroupChange={vi.fn()}
      onKeywordChange={vi.fn()}
      onNew={vi.fn()}
      onPin={vi.fn()}
      onSelect={onSelect}
      onShare={vi.fn()}
      onViewChange={vi.fn()}
      sessionView="active"
      sessions={[session()]}
      streamingSessionIds={[]}
    />,
  )
  return onSelect
}

describe('ConversationSidebar', () => {
  it('keeps session selection and management as separate buttons', () => {
    renderSidebar()
    const selectButton = screen.getByText('库存分析会话').closest('button')
    const manageButton = screen.getByRole('button', {
      name: /管理会话.*库存分析会话/,
    })

    expect(selectButton).toHaveAttribute('aria-current', 'true')
    expect(selectButton).not.toContainElement(manageButton)
  })

  it('supports native keyboard selection without menu key propagation', async () => {
    const user = userEvent.setup()
    const onSelect = renderSidebar()
    const selectButton = screen.getByText('库存分析会话').closest('button')!
    const manageButton = screen.getByRole('button', {
      name: /管理会话.*库存分析会话/,
    })

    selectButton.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(manageButton, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(2)
  })
})
