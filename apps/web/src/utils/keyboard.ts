import type { KeyboardEvent } from 'react'

export function activateOnKeyboard(
  event: KeyboardEvent,
  action: () => void,
): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  action()
}
