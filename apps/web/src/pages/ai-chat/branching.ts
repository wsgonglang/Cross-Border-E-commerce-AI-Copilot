import type { AiMessage } from '@cross-border/shared'

export function getActiveLineage(
  messages: AiMessage[],
  activeLeafMessageId?: string,
): AiMessage[] {
  if (!messages.length) return []
  const byId = new Map(messages.map((message) => [message.id, message]))
  let current = byId.get(activeLeafMessageId ?? '') ?? messages.at(-1)
  const lineage: AiMessage[] = []
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    lineage.push(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return lineage.reverse()
}

export function getMessageSiblings(
  messages: AiMessage[],
  message: AiMessage,
): AiMessage[] {
  if (!message.parentId) {
    return messages.filter(
      (candidate) => !candidate.parentId && candidate.role === message.role,
    )
  }
  const byId = new Map(messages.map((candidate) => [candidate.id, candidate]))
  const parent = byId.get(message.parentId)
  return (parent?.childrenIds ?? [])
    .map((id) => byId.get(id))
    .filter(
      (candidate): candidate is AiMessage =>
        Boolean(candidate) && candidate?.role === message.role,
    )
}
