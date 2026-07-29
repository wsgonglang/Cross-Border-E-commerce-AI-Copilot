import type { AgentRunResponse, AgentToolName } from '@cross-border/shared'
import {
  Alert,
  Button,
  Card,
  Input,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import { RobotOutlined, SendOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { runAgent } from '../api/agent'

const toolLabels: Record<AgentToolName | 'unknown', string> = {
  search_products: '查询商品',
  get_inventory: '查询库存',
  get_order_status: '查询订单',
  get_business_overview: '经营概览',
  search_platform_rules: '检索规则',
  create_product_optimization_draft: '创建优化草稿',
  unknown: '未授权工具',
}

const quickPrompts = [
  '查询 P-DEMO-001 的库存',
  '查询订单 ORD-20260701-001 的状态',
  '查看今日经营看板',
  '检查充电器标题和认证相关规则',
  '为 P-DEMO-001 创建西班牙语优化草稿',
]

interface Props {
  token: string
  merchantId: string
}

export function AgentPanel({ token, merchantId }: Props) {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AgentRunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (preset?: string) => {
    const content = (preset ?? message).trim()
    if (!content || running) return
    setMessage(content)
    setRunning(true)
    setError(null)
    try {
      setResult(await runAgent(token, merchantId, content))
    } catch (runError: unknown) {
      setError(runError instanceof Error ? runError.message : 'Agent 执行失败')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="agent-panel">
      <Alert
        type="info"
        showIcon
        title="受控业务 Agent"
        description="Agent 只能调用白名单业务工具。唯一写工具仅创建优化草稿，正式商品仍需在商品管理中人工确认。"
      />

      <Space wrap className="agent-quick-prompts">
        {quickPrompts.map((prompt) => (
          <Button
            key={prompt}
            size="small"
            onClick={() => void submit(prompt)}
            disabled={running}
          >
            {prompt}
          </Button>
        ))}
      </Space>

      <Card size="small">
        <Input.TextArea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={1000}
          showCount
          placeholder="例如：查询 P-DEMO-001 的库存，并检查充电器合规规则"
        />
        <Button
          className="agent-run-button"
          type="primary"
          icon={<SendOutlined />}
          loading={running}
          disabled={!message.trim()}
          onClick={() => void submit()}
        >
          执行业务 Agent
        </Button>
      </Card>

      {error ? <Alert type="error" showIcon title={error} /> : null}

      {result ? (
        <>
          <Card
            size="small"
            title={
              <Space>
                <RobotOutlined />
                Agent 结论
              </Space>
            }
            extra={<Tag>Token {result.usage.totalTokens}</Tag>}
          >
            <Typography.Paragraph className="agent-answer">
              {result.answer}
            </Typography.Paragraph>
            {result.createdOptimizationIds.length ? (
              <Alert
                type="warning"
                showIcon
                title="已创建待确认草稿"
                description="请前往商品管理打开 AI 优化抽屉，核对原文、风险和建议后再人工写回。"
              />
            ) : null}
            <Space wrap style={{ marginTop: 12 }}>
              <Button onClick={() => void navigate('/ai-results')}>
                前往 AI 成果中心
              </Button>
              {result.toolCalls.flatMap((call) => {
                if (
                  call.name !== 'create_product_optimization_draft' ||
                  call.status !== 'success' ||
                  typeof call.output !== 'object' ||
                  call.output === null
                ) {
                  return []
                }
                const output = call.output as Record<string, unknown>
                if (
                  typeof output.productId !== 'string' ||
                  typeof output.optimizationId !== 'string'
                ) {
                  return []
                }
                const params = new URLSearchParams({
                  merchantId,
                  productId: output.productId,
                  optimizationId: output.optimizationId,
                  ...(typeof output.productCode === 'string'
                    ? { keyword: output.productCode }
                    : {}),
                })
                return [
                  <Button
                    type="primary"
                    key={output.optimizationId}
                    onClick={() =>
                      void navigate(`/products?${params.toString()}`)
                    }
                  >
                    立即审核草稿
                  </Button>,
                ]
              })}
            </Space>
          </Card>

          <Card size="small" title="工具执行轨迹">
            <Timeline
              items={result.toolCalls.map((call) => ({
                color: call.status === 'success' ? 'green' : 'red',
                content: (
                  <div>
                    <Space>
                      <Typography.Text strong>
                        {toolLabels[call.name]}
                      </Typography.Text>
                      <Tag color={call.status === 'success' ? 'green' : 'red'}>
                        {call.status}
                      </Tag>
                    </Space>
                    <pre className="agent-tool-result">
                      {JSON.stringify(
                        call.status === 'success' ? call.output : call.error,
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                ),
              }))}
            />
          </Card>
        </>
      ) : null}
    </div>
  )
}
