import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { useAiChatNavigation } from './use-ai-chat-navigation'

function NavigationHarness({
  selectSession,
}: {
  selectSession: (sessionId: string) => void
}) {
  const [inputValue, setInputValue] = useState('')
  const location = useLocation()
  useAiChatNavigation({ inputValue, selectSession, setInputValue })

  return (
    <div>
      <span data-testid="input">{inputValue}</span>
      <span data-testid="state">{JSON.stringify(location.state)}</span>
      <button type="button" onClick={() => setInputValue('用户继续编辑')}>
        编辑
      </button>
    </div>
  )
}

describe('useAiChatNavigation', () => {
  it('consumes prompt and session navigation state exactly once', async () => {
    const selectSession = vi.fn()
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/ai-chat',
            state: { prefill: '分析经营变化', sessionId: 'session-1' },
          },
        ]}
      >
        <NavigationHarness selectSession={selectSession} />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('input')).toHaveTextContent('分析经营变化'),
    )
    expect(selectSession).toHaveBeenCalledOnce()
    expect(selectSession).toHaveBeenCalledWith('session-1')
    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('null'),
    )

    fireEvent.click(screen.getByRole('button', { name: '编辑' }))
    expect(screen.getByTestId('input')).toHaveTextContent('用户继续编辑')
    expect(selectSession).toHaveBeenCalledOnce()
  })
})
