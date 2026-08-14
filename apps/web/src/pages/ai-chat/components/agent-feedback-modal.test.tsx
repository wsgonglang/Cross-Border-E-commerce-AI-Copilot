import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AgentFeedbackModal } from './agent-feedback-modal'

describe('AgentFeedbackModal', () => {
  it('requires and submits a machine-readable negative-feedback reason', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true)
    render(<AgentFeedbackModal open onCancel={vi.fn()} onSubmit={onSubmit} />)

    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByText('工具选择错误'))
    fireEvent.change(screen.getByPlaceholderText(/错误的商品/), {
      target: { value: '查错了商品' },
    })
    fireEvent.click(screen.getByRole('button', { name: '提交反馈' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        reason: 'WRONG_TOOL',
        comment: '查错了商品',
      }),
    )
  })
})
