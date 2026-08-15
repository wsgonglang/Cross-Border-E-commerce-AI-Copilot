import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { readAiChatNavigationState } from '../navigation'

interface UseAiChatNavigationInput {
  inputValue: string
  selectSession: (sessionId: string) => void
  setInputValue: (value: string) => void
}

export function useAiChatNavigation({
  inputValue,
  selectSession,
  setInputValue,
}: UseAiChatNavigationInput) {
  const location = useLocation()
  const navigate = useNavigate()
  const consumedNavigationKeyRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (consumedNavigationKeyRef.current === location.key) return
    const navigationState = readAiChatNavigationState(location.state)
    if (!navigationState) return

    consumedNavigationKeyRef.current = location.key
    if (navigationState.sessionId) {
      selectSession(navigationState.sessionId)
    }
    if (navigationState.prefill && !inputValue.trim()) {
      setInputValue(navigationState.prefill)
    }
    void navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    })
  }, [
    inputValue,
    location.key,
    location.pathname,
    location.search,
    location.state,
    navigate,
    selectSession,
    setInputValue,
  ])
}
