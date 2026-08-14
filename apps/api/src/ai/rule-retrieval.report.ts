import {
  evaluateRuleRetrieval,
  ruleEvaluationThresholds,
  type RuleEvaluationMetrics,
} from './rule-retrieval.evaluation'

const labels: Record<keyof RuleEvaluationMetrics, string> = {
  hitAt1: 'Hit@1',
  recallAt3: 'Recall@3',
  mrr: 'MRR',
  abstentionAccuracy: '拒答准确率',
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function row(columns: string[]): string {
  return columns.map((column) => column.padEnd(16)).join('')
}

const report = evaluateRuleRetrieval()
const output = [
  '规则 RAG 离线评估',
  `数据集：${report.totalCases} 条（有答案 ${report.positiveCases} / 无答案 ${report.noAnswerCases}）`,
  '',
  row(['指标', '当前值', '最低门槛', '结果']),
  row(['----------------', '----------------', '----------------', '--------']),
]

for (const [name, threshold] of Object.entries(ruleEvaluationThresholds)) {
  const metricName = name as keyof RuleEvaluationMetrics
  const value = report.metrics[metricName]
  output.push(
    row([
      labels[metricName],
      percentage(value),
      percentage(threshold),
      value >= threshold ? 'PASS' : 'FAIL',
    ]),
  )
}

if (report.retrievalFailures.length > 0) {
  output.push('', '未排在 Top 1 的有答案问题：')
  for (const failure of report.retrievalFailures) {
    output.push(
      `- ${failure.query}`,
      `  期望=${failure.expected}，实际排名=${failure.rank ?? '未进入 Top 3'}，返回=${failure.returned.join(', ') || '空'}`,
    )
  }
}

if (report.abstentionFailures.length > 0) {
  output.push('', '应拒答但被判定为可回答的问题：')
  for (const failure of report.abstentionFailures) {
    output.push(
      `- ${failure.query}`,
      `  返回=${failure.returned.join(', ') || '空'}`,
    )
  }
}

output.push('', report.passed ? '评估结论：PASS' : '评估结论：FAIL')
process.stdout.write(`${output.join('\n')}\n`)
if (!report.passed) process.exitCode = 1
