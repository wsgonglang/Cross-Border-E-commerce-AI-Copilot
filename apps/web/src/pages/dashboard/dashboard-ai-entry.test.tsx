import type { AiSessionSummary } from '@cross-border/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DashboardAiEntry } from './dashboard-ai-entry'

function session(id: string): AiSessionSummary {
  return {
    id,
    merchantId: 'merchant-1',
    userId: 'user-1',
    title: `会话 ${id}`,
    status: 'done',
    pinned: false,
    messageCount: 2,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T09:00:00.000Z',
  }
}

describe('DashboardAiEntry', () => {
  it('hands a free-form prompt to the unified assistant without sending it', () => {
    const onOpen = vi.fn()
    render(
      <DashboardAiEntry
        canWrite
        days={7}
        loadingSessions={false}
        onOpen={onOpen}
        sessions={[]}
        storeName="北美店铺"
      />,
    )

    fireEvent.change(
      screen.getByRole('textbox', {
        name: '输入希望 AI 协助分析的问题',
      }),
      { target: { value: '分析退款原因' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /去助手处理/ }))

    expect(onOpen).toHaveBeenCalledWith({ prefill: '分析退款原因' })
  })

  it('shows at most three recent sessions and targets the exact session', () => {
    const onOpen = vi.fn()
    render(
      <DashboardAiEntry
        canWrite={false}
        days={30}
        loadingSessions={false}
        onOpen={onOpen}
        sessions={[session('1'), session('2'), session('3'), session('4')]}
      />,
    )

    expect(screen.queryByText('会话 4')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('会话 2'))
    expect(onOpen).toHaveBeenCalledWith({ sessionId: '2' })
  })

  it('keeps the assistant entry usable when recent sessions fail', () => {
    const onOpen = vi.fn()
    render(
      <DashboardAiEntry
        canWrite
        days={7}
        loadingSessions={false}
        onOpen={onOpen}
        sessionError="network"
        sessions={[]}
      />,
    )

    expect(
      screen.getByText('最近会话暂时无法加载，不影响经营数据和快捷入口'),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '打开助手' }))
    expect(onOpen).toHaveBeenCalledWith()
  })
})
