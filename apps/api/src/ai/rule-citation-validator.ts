import type {
  AgentToolCallSummary,
  RuleSearchResult,
} from '@cross-border/shared'

const INSUFFICIENT_RULE_ANSWER =
  '当前可访问规则文档信息不足，不能据此给出平台规则结论。请补充适用平台、市场或规则来源后重试。'
const INVALID_CITATION_ANSWER =
  '模型生成的规则结论未通过引用校验，请以工具轨迹中的规则原文为准并重新检索。'

function asRuleResult(call: AgentToolCallSummary): RuleSearchResult | null {
  if (
    call.name !== 'search_platform_rules' ||
    call.status !== 'success' ||
    typeof call.output !== 'object' ||
    call.output === null
  ) {
    return null
  }
  return call.output as unknown as RuleSearchResult
}

export interface CitationValidationResult {
  answer: string
  valid: boolean
  cited: string[]
  available: string[]
  reason?: 'INSUFFICIENT_SOURCES' | 'INVALID_CITATION' | 'MISSING_CITATION'
}

/**
 * 生成后的确定性安全闸：引用编号必须来自本次规则工具结果；有规则结论时不能省略引用。
 * 不调用模型做裁判，因此可在 CI 中稳定回归。
 */
export function validateRuleCitations(
  answer: string,
  toolCalls: AgentToolCallSummary[],
): CitationValidationResult {
  const ruleResults = toolCalls.map(asRuleResult).filter(Boolean)
  if (ruleResults.length === 0) {
    return { answer, valid: true, cited: [], available: [] }
  }

  const available = [
    ...new Set(
      ruleResults.flatMap((result) =>
        result!.sufficient
          ? result!.sources.map((source) => source.citation)
          : [],
      ),
    ),
  ]
  const cited = [
    ...new Set([...answer.matchAll(/\[(R\d+)\]/g)].map((match) => match[1]!)),
  ]

  if (available.length === 0) {
    return {
      answer: INSUFFICIENT_RULE_ANSWER,
      valid: false,
      cited,
      available,
      reason: 'INSUFFICIENT_SOURCES',
    }
  }
  if (cited.some((citation) => !available.includes(citation))) {
    return {
      answer: INVALID_CITATION_ANSWER,
      valid: false,
      cited,
      available,
      reason: 'INVALID_CITATION',
    }
  }
  if (cited.length === 0) {
    return {
      answer: INVALID_CITATION_ANSWER,
      valid: false,
      cited,
      available,
      reason: 'MISSING_CITATION',
    }
  }
  return { answer, valid: true, cited, available }
}
