import {
  Alert,
  Button,
  Card,
  Input,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import { RobotOutlined, SendOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { runAgent } from '../../api/agent'
import { useAgentRunQuery } from '../../queries/operations.queries'

import './styles.css'

interface Props {
  token: string
  merchantId: string
  storeId?: string
  storeName?: string
  days?: number
  sourcePage?: string
  canWrite?: boolean
  quickPrompts?: string[]
}

export function AgentPanel({
  token,
  merchantId,
  storeId,
  storeName,
  days = 7,
  sourcePage,
  canWrite = true,
  quickPrompts,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [starting, setStarting] = useState(false)
  const [runId, setRunId] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  // 提交后持续轮询运行记录，工具轨迹逐步落库、逐步展示。
  const runQuery = useAgentRunQuery(token, merchantId, runId, { poll: true })
  const result = runQuery.data ?? null
  const finished = result?.status === 'COMPLETED' || result?.status === 'FAILED'
  const running = starting || Boolean(runId && !finished)
  const defaultQuickPrompts = [
    t('agent.quick.inventory'),
    t('agent.quick.order'),
    t('agent.quick.dashboard'),
    t('agent.quick.compliance'),
    t('agent.quick.draft'),
  ]
  const visiblePrompts = quickPrompts ?? defaultQuickPrompts

  const submit = async (preset?: string) => {
    const content = (preset ?? message).trim()
    if (!content || running) return
    setMessage(content)
    setStarting(true)
    setError(null)
    setRunId(undefined)
    try {
      const started = await runAgent(token, merchantId, content, {
        storeId,
        days,
        sourcePage,
      })
      setRunId(started.runId)
    } catch (runError: unknown) {
      setError(runError instanceof Error ? runError.message : t('agent.failed'))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="agent-panel">
      <Alert
        type="info"
        showIcon
        title={t('agent.title')}
        description={t('agent.description')}
      />

      <Space wrap className="agent-quick-prompts">
        {visiblePrompts
          .filter((prompt) => canWrite || prompt !== defaultQuickPrompts.at(-1))
          .map((prompt) => (
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

      <Card
        size="small"
        extra={storeName ? <Tag color="cyan">{storeName}</Tag> : null}
      >
        <Input.TextArea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={1000}
          showCount
          placeholder={t('agent.placeholder')}
        />
        <Button
          className="agent-run-button"
          type="primary"
          icon={<SendOutlined />}
          loading={running}
          disabled={!message.trim()}
          onClick={() => void submit()}
        >
          {t('agent.run')}
        </Button>
      </Card>

      {error ? <Alert type="error" showIcon title={error} /> : null}
      {result?.status === 'FAILED' ? (
        <Alert
          type="error"
          showIcon
          title={t('agent.failed')}
          description={result.error}
        />
      ) : null}

      {running && runId ? (
        <Alert
          type="info"
          showIcon
          icon={<Spin size="small" />}
          title={t('agent.running')}
        />
      ) : null}

      {result?.status === 'COMPLETED' ? (
        <Card
          size="small"
          title={
            <Space>
              <RobotOutlined />
              {t('agent.conclusion')}
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
              title={t('agent.draftCreated')}
              description={t('agent.draftHint')}
            />
          ) : null}
          <Space wrap className="agent-result-actions">
            <Button onClick={() => void navigate('/ai-results')}>
              {t('agent.results')}
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
                  {t('agent.reviewNow')}
                </Button>,
              ]
            })}
          </Space>
        </Card>
      ) : null}

      {result && result.toolCalls.length > 0 ? (
        <Card size="small" title={t('agent.trace')}>
          <Timeline
            items={result.toolCalls.map((call) => ({
              color: call.status === 'success' ? 'green' : 'red',
              content: (
                <div>
                  <Space>
                    <Typography.Text strong>
                      {t(`agent.tools.${call.name}`, {
                        defaultValue: call.name,
                      })}
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
      ) : null}
    </div>
  )
}
