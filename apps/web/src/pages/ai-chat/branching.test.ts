import type { AiMessage } from '@cross-border/shared'
import { describe, expect, it } from 'vitest'

import { getActiveLineage, getMessageSiblings } from './branching'

const message = (
  id: string,
  role: AiMessage['role'],
  parentId?: string,
  childrenIds: string[] = [],
): AiMessage => ({
  id,
  sessionId: 'session-1',
  role,
  content: id,
  parentId,
  childrenIds,
  links: [],
  createdAt: new Date().toISOString(),
})

describe('AI message branching', () => {
  const messages = [
    message('user-1', 'user', undefined, ['answer-1', 'answer-2']),
    message('answer-1', 'assistant', 'user-1', ['user-2a']),
    message('answer-2', 'assistant', 'user-1', ['user-2b']),
    message('user-2a', 'user', 'answer-1'),
    message('user-2b', 'user', 'answer-2'),
  ]

  it('只返回活动叶节点所在的完整血缘', () => {
    expect(getActiveLineage(messages, 'user-2b').map(({ id }) => id)).toEqual([
      'user-1',
      'answer-2',
      'user-2b',
    ])
  })

  it('根据父消息 childrenIds 返回有序兄弟分支', () => {
    expect(
      getMessageSiblings(messages, messages[2]!).map(({ id }) => id),
    ).toEqual(['answer-1', 'answer-2'])
  })

  it('支持没有父节点的根消息分叉', () => {
    const roots = [message('root-a', 'user'), message('root-b', 'user')]
    expect(getMessageSiblings(roots, roots[1]!).map(({ id }) => id)).toEqual([
      'root-a',
      'root-b',
    ])
  })
})
