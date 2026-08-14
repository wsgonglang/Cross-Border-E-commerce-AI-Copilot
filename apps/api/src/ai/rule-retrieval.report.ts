import {
  evaluateRuleRetrieval,
  ruleCombinedDataset,
  ruleDevelopmentDataset,
  ruleEvaluationThresholds,
  ruleTestDataset,
  type RuleEvaluationReport,
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

function renderReport(report: RuleEvaluationReport, title: string): string[] {
  const output = [
    title,
    `数据集：${report.totalCases} 条（有答案 ${report.positiveCases} / 无答案 ${report.noAnswerCases}）`,
    '',
    row(['指标', '当前值', '最低门槛', '结果']),
    row([
      '----------------',
      '----------------',
      '----------------',
      '--------',
    ]),
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
    output.push('', '未满足 Top 1 或 Top 3 召回期望的有答案问题：')
    for (const failure of report.retrievalFailures) {
      output.push(
        `- ${failure.query}`,
        `  期望=${failure.expected.join(', ')}，首个相关结果排名=${failure.rank ?? '未进入 Top 3'}，返回=${failure.returned.join(', ') || '空'}`,
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
  return output
}

const reports = [
  {
    title: 'Development Set（允许用于调参）',
    report: evaluateRuleRetrieval(ruleDevelopmentDataset),
  },
  {
    title: 'Test Set（v3 起冻结）',
    report: evaluateRuleRetrieval(ruleTestDataset),
  },
  {
    title: 'Combined（仅作总体回归）',
    report: evaluateRuleRetrieval(ruleCombinedDataset),
  },
]
const output = [
  '规则 RAG 离线评估',
  '调参只使用 Development Set；Test Set 的问题和期望从 v3 起冻结。',
  '',
  ...reports.flatMap(({ title, report }, index) => [
    ...(index > 0 ? ['', ''] : []),
    ...renderReport(report, title),
  ]),
]
process.stdout.write(`${output.join('\n')}\n`)
if (reports.some(({ report }) => !report.passed)) process.exitCode = 1
