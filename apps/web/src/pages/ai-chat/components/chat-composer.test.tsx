import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChatComposer } from './chat-composer'

describe('ChatComposer', () => {
  it('keeps send disabled for blank input', () => {
    render(
      <ChatComposer
        inputValue="   "
        streaming={false}
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '发送消息' })).toBeDisabled()
  })

  it('sends on Enter but preserves Shift+Enter for multiline input', () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(
      <ChatComposer
        inputValue="分析这个商品"
        streaming={false}
        onChange={vi.fn()}
        onSend={onSend}
        onStop={vi.fn()}
      />,
    )
    const input = screen.getByRole('textbox')

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledOnce()
  })

  it('exposes stop while a response is streaming', () => {
    const onStop = vi.fn()
    render(
      <ChatComposer
        inputValue=""
        streaming
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={onStop}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '停止生成' }))
    expect(onStop).toHaveBeenCalledOnce()
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
