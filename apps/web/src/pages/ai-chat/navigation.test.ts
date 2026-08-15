import { describe, expect, it } from 'vitest'

import { readAiChatNavigationState } from './navigation'

describe('readAiChatNavigationState', () => {
  it('normalizes a dashboard prompt and exact session target', () => {
    expect(
      readAiChatNavigationState({
        prefill: '  分析近 7 天的订单变化  ',
        sessionId: ' session-1 ',
      }),
    ).toEqual({
      prefill: '分析近 7 天的订单变化',
      sessionId: 'session-1',
    })
  })

  it('ignores malformed and oversized navigation state', () => {
    expect(readAiChatNavigationState('prompt')).toBeNull()
    expect(
      readAiChatNavigationState({ prefill: 'x'.repeat(1001), sessionId: '' }),
    ).toBeNull()
  })
})
