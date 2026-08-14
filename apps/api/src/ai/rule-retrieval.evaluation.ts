import {
  assessRuleRanking,
  chunkRuleContent,
  rankRuleChunks,
  type RetrievalCandidate,
} from './rule-retrieval'

const documents = [
  {
    id: 'electric',
    title: '电器商品发布规范',
    content:
      '# 充电器\n\n充电器发布前必须核对插头类型、输入电压和目标市场安全认证。认证资料不完整时不得声称已经通过认证。',
  },
  {
    id: 'claims',
    title: '标题与营销声明规范',
    content:
      '# 营销声明\n\n商品标题不得堆砌无关关键词。最好、第一、百分百有效等绝对化声明必须有可验证依据。',
  },
  {
    id: 'battery',
    title: '锂电池运输规范',
    content:
      '# 航空运输\n\n含锂电池商品航空运输前应核对额定能量、UN38.3 测试摘要、危险品标签和承运人限制。',
  },
  {
    id: 'cosmetics',
    title: '化妆品成分与功效规范',
    content:
      '# 成分标签\n\n化妆品需要展示完整成分表，不得使用治疗疾病、永久祛斑等医疗功效声明。',
  },
  {
    id: 'children',
    title: '儿童商品安全规范',
    content:
      '# 年龄和警告\n\n儿童玩具必须标注适用年龄、窒息风险警告，并核对小零件和目标市场安全测试要求。',
  },
  {
    id: 'food',
    title: '食品标签发布规范',
    content:
      '# 食品标签\n\n预包装食品必须展示配料、过敏原、净含量、保质期和原产国，不得宣传未经证明的疾病治疗效果。',
  },
  {
    id: 'returns',
    title: '退货与退款政策',
    content:
      '# 退款时效\n\n商家收到退货并完成商品检查后，应在五个工作日内发起退款，并保留退款处理记录。',
  },
  {
    id: 'privacy',
    title: '客户数据与隐私规范',
    content:
      '# 客户信息\n\n客户邮箱、电话和收货地址只能用于订单履约，不得导出用于未经授权的营销活动。',
  },
]

export const ruleEvaluationCandidates: RetrievalCandidate[] = documents.flatMap(
  (document) =>
    chunkRuleContent(document.content).map((chunk) => ({
      id: `${document.id}-${chunk.sequence}`,
      content: chunk.content,
      heading: chunk.heading ?? null,
      searchTerms: chunk.searchTerms,
      document: {
        id: document.id,
        title: document.title,
        platform: 'DEMO_MARKETPLACE',
        market: null,
        category: null,
        version: '2026.1',
        scope: 'GLOBAL',
        sourceUrl: null,
      },
    })),
)

export const rulePositiveCases = [
  ['充电器需要核对哪些电压和认证', 'electric'],
  ['电源适配器发布前要检查输入电压吗', 'electric'],
  ['认证资料不全能写已经通过认证吗', 'electric'],
  ['标题可以写最好和百分百有效吗', 'claims'],
  ['关键词堆砌是否违反标题规范', 'claims'],
  ['第一品牌这种营销声明需要依据吗', 'claims'],
  ['锂电池航空运输需要 UN38.3 吗', 'battery'],
  ['含电池商品空运要检查什么资料', 'battery'],
  ['危险品标签和承运人限制怎么核对', 'battery'],
  ['化妆品需要完整成分表吗', 'cosmetics'],
  ['护肤品能宣传永久祛斑吗', 'cosmetics'],
  ['化妆品可以写治疗疾病功效吗', 'cosmetics'],
  ['儿童玩具需要标注适用年龄吗', 'children'],
  ['玩具小零件要写窒息风险警告吗', 'children'],
  ['儿童商品目标市场安全测试要求', 'children'],
  ['预包装食品必须展示哪些标签', 'food'],
  ['食品过敏原和保质期需要标注吗', 'food'],
  ['食品可以宣传治疗疾病吗', 'food'],
  ['收到退货以后几天发起退款', 'returns'],
  ['退款处理记录是否需要保留', 'returns'],
  ['商品检查完成后的退款时效', 'returns'],
  ['客户邮箱能导出做营销吗', 'privacy'],
  ['收货地址只能用于订单履约吗', 'privacy'],
  ['未经授权可以使用客户电话营销吗', 'privacy'],
] as const

export const ruleNoAnswerCases = [
  '宠物食品冷链温度是多少',
  '巴西进口关税税率是多少',
  '仓库消防通道应该多宽',
  '员工每年有多少天年假',
  '直播间主播佣金怎么算',
  '数据库备份应该保留几个月',
  '海运集装箱最大装载重量',
  '办公室打印机怎么连接无线网络',
] as const

export const ruleEvaluationThresholds = {
  hitAt1: 0.85,
  recallAt3: 0.95,
  mrr: 0.9,
  abstentionAccuracy: 0.875,
} as const

export interface RuleEvaluationMetrics {
  hitAt1: number
  recallAt3: number
  mrr: number
  abstentionAccuracy: number
}

export interface RuleEvaluationFailure {
  query: string
  expected: string
  returned: string[]
  rank: number | null
}

export interface RuleEvaluationReport {
  totalCases: number
  positiveCases: number
  noAnswerCases: number
  metrics: RuleEvaluationMetrics
  retrievalFailures: RuleEvaluationFailure[]
  abstentionFailures: Array<{ query: string; returned: string[] }>
  passed: boolean
}

export function evaluateRuleRetrieval(
  candidates: RetrievalCandidate[] = ruleEvaluationCandidates,
): RuleEvaluationReport {
  let hitAt1 = 0
  let recallAt3 = 0
  let reciprocalRank = 0
  const retrievalFailures: RuleEvaluationFailure[] = []

  for (const [query, expected] of rulePositiveCases) {
    const ranked = rankRuleChunks(query, candidates, 3)
    const returned = ranked.map((result) => result.candidate.document.id)
    const rankIndex = returned.indexOf(expected)
    if (rankIndex === 0) hitAt1 += 1
    if (rankIndex >= 0) {
      recallAt3 += 1
      reciprocalRank += 1 / (rankIndex + 1)
    }
    if (rankIndex !== 0) {
      retrievalFailures.push({
        query,
        expected,
        returned,
        rank: rankIndex >= 0 ? rankIndex + 1 : null,
      })
    }
  }

  const abstentionFailures = ruleNoAnswerCases.flatMap((query) => {
    const ranked = rankRuleChunks(query, candidates, 3)
    return assessRuleRanking(ranked).sufficient
      ? [{ query, returned: ranked.map((item) => item.candidate.document.id) }]
      : []
  })
  const metrics = {
    hitAt1: hitAt1 / rulePositiveCases.length,
    recallAt3: recallAt3 / rulePositiveCases.length,
    mrr: reciprocalRank / rulePositiveCases.length,
    abstentionAccuracy:
      (ruleNoAnswerCases.length - abstentionFailures.length) /
      ruleNoAnswerCases.length,
  }
  const passed = Object.entries(ruleEvaluationThresholds).every(
    ([name, threshold]) =>
      metrics[name as keyof RuleEvaluationMetrics] >= threshold,
  )

  return {
    totalCases: rulePositiveCases.length + ruleNoAnswerCases.length,
    positiveCases: rulePositiveCases.length,
    noAnswerCases: ruleNoAnswerCases.length,
    metrics,
    retrievalFailures,
    abstentionFailures,
    passed,
  }
}
