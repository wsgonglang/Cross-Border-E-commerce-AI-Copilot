import type {
  AiShareCandidate,
  AiSessionShareSummary,
  AiSessionSummary,
} from '@cross-border/shared'
import { useCallback, useState } from 'react'

import {
  createAiSessionShare,
  getAiShareCandidates,
  listAiSessionShares,
  revokeAiSessionShare,
} from '../../../api/ai'

interface UseAiSharingInput {
  merchantId: string
  token: string
}

export function useAiSharing({ merchantId, token }: UseAiSharingInput) {
  const [session, setSession] = useState<AiSessionSummary | null>(null)
  const [candidates, setCandidates] = useState<AiShareCandidate[]>([])
  const [shares, setShares] = useState<AiSessionShareSummary[]>([])

  const open = useCallback(
    async (target: AiSessionSummary) => {
      setSession(target)
      const [nextCandidates, records] = await Promise.all([
        getAiShareCandidates(token, merchantId),
        listAiSessionShares(token, merchantId, target.id),
      ])
      setCandidates(nextCandidates)
      setShares(records)
    },
    [merchantId, token],
  )

  const close = useCallback(() => setSession(null), [])

  const create = useCallback(
    async (recipientUserIds: string[], expiresInHours: number) => {
      if (!session) return null
      const created = await createAiSessionShare(
        token,
        merchantId,
        session.id,
        recipientUserIds,
        expiresInHours,
      )
      setShares((current) => [created, ...current])
      return created
    },
    [merchantId, session, token],
  )

  const revoke = useCallback(
    async (shareId: string) => {
      const updated = await revokeAiSessionShare(token, merchantId, shareId)
      setShares((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
    },
    [merchantId, token],
  )

  const copyLink = useCallback(
    async (shareId: string) => {
      const url = `${window.location.origin}/ai-shares/${shareId}?merchantId=${merchantId}`
      await navigator.clipboard.writeText(url)
    },
    [merchantId],
  )

  return {
    candidates,
    close,
    copyLink,
    create,
    open,
    revoke,
    session,
    shares,
  }
}
