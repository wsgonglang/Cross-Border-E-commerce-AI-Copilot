import {
  type OptimizationLanguage,
  type ProductOptimizationSummary,
  type ProductSummary,
} from '@cross-border/shared'
import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Popconfirm,
  Progress,
  Select,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import { useEffect, useState } from 'react'

import {
  applyProductOptimization,
  createProductOptimization,
  getProductOptimizations,
  getProductOptimization,
  rejectProductOptimization,
} from '../api/product-optimizations'

const languageLabels: Record<OptimizationLanguage, string> = {
  'en-US': '英语（美国）',
  'es-ES': '西班牙语',
  'pt-BR': '葡萄牙语（巴西）',
}
const optimizationLanguages: OptimizationLanguage[] = [
  'en-US',
  'es-ES',
  'pt-BR',
]

interface Props {
  open: boolean
  token: string
  merchantId: string
  product: ProductSummary | null
  initialOptimizationId?: string
  onClose: () => void
  onApplied: () => Promise<void>
}

export function ProductOptimizationDrawer({
  open,
  token,
  merchantId,
  product,
  initialOptimizationId,
  onClose,
  onApplied,
}: Props) {
  const [targetLanguage, setTargetLanguage] =
    useState<OptimizationLanguage>('en-US')
  const [optimization, setOptimization] =
    useState<ProductOptimizationSummary | null>(null)
  const [loadedProductId, setLoadedProductId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [messageApi, messageContext] = message.useMessage()

  useEffect(() => {
    if (!open || !product) return
    let active = true
    const request = initialOptimizationId
      ? getProductOptimization(
          token,
          merchantId,
          product.id,
          initialOptimizationId,
        )
      : getProductOptimizations(token, merchantId, product.id).then(
          (records) => records[0] ?? null,
        )
    void request
      .then((record) => {
        if (active) setOptimization(record)
      })
      .catch((error: unknown) => {
        if (active) {
          void messageApi.error(
            error instanceof Error ? error.message : '优化记录加载失败',
          )
        }
      })
      .finally(() => {
        if (active) setLoadedProductId(product.id)
      })
    return () => {
      active = false
    }
  }, [initialOptimizationId, merchantId, messageApi, open, product, token])

  const generate = async () => {
    if (!product) return
    setGenerating(true)
    try {
      setOptimization(
        await createProductOptimization(
          token,
          merchantId,
          product.id,
          targetLanguage,
        ),
      )
      void messageApi.success('结构化优化草稿已生成，请人工确认')
    } catch (error: unknown) {
      void messageApi.error(
        error instanceof Error ? error.message : 'AI 优化失败',
      )
    } finally {
      setGenerating(false)
    }
  }

  const apply = async () => {
    if (!product || !optimization) return
    setLoading(true)
    try {
      setOptimization(
        await applyProductOptimization(
          token,
          merchantId,
          product.id,
          optimization.id,
        ),
      )
      await onApplied()
      void messageApi.success('草稿已写回商品，版本和审计记录已保存')
    } catch (error: unknown) {
      void messageApi.error(
        error instanceof Error ? error.message : '草稿应用失败',
      )
    } finally {
      setLoading(false)
    }
  }

  const reject = async () => {
    if (!product || !optimization) return
    setLoading(true)
    try {
      setOptimization(
        await rejectProductOptimization(
          token,
          merchantId,
          product.id,
          optimization.id,
        ),
      )
      void messageApi.success('草稿已拒绝，正式商品未发生变化')
    } catch (error: unknown) {
      void messageApi.error(
        error instanceof Error ? error.message : '草稿拒绝失败',
      )
    } finally {
      setLoading(false)
    }
  }

  const draft = optimization?.draft

  return (
    <Drawer
      title={`AI 商品优化 · ${product?.code ?? ''}`}
      width={820}
      open={open}
      onClose={onClose}
      extra={
        <Space>
          <Select
            value={targetLanguage}
            onChange={setTargetLanguage}
            options={optimizationLanguages.map((value) => ({
              value,
              label: languageLabels[value],
            }))}
          />
          <Button
            type="primary"
            loading={generating}
            onClick={() => void generate()}
          >
            {optimization ? '重新生成' : '生成草稿'}
          </Button>
        </Space>
      }
    >
      {messageContext}
      <Spin
        spinning={
          loading ||
          generating ||
          Boolean(open && product && loadedProductId !== product.id)
        }
      >
        {generating ? (
          <Timeline
            items={[
              { color: 'green', children: '读取商品和 SKU 上下文' },
              { color: 'blue', children: '生成目标市场文案' },
              { color: 'gray', children: '校验结构与合规风险' },
            ]}
          />
        ) : null}

        {!optimization && !generating ? (
          <Empty description="选择目标语言并生成第一份 AI 草稿" />
        ) : null}

        {optimization ? (
          <>
            <Descriptions size="small" bordered column={3}>
              <Descriptions.Item label="状态">
                <Tag
                  color={
                    optimization.status === 'APPLIED'
                      ? 'green'
                      : optimization.status === 'DRAFT'
                        ? 'blue'
                        : 'default'
                  }
                >
                  {optimization.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="模型">
                {optimization.providerName} / {optimization.modelName}
              </Descriptions.Item>
              <Descriptions.Item label="Token">
                {optimization.usage.totalTokens}
              </Descriptions.Item>
            </Descriptions>

            {optimization.error ? (
              <Alert
                className="optimization-alert"
                type="error"
                showIcon
                message={optimization.error}
              />
            ) : null}

            {draft ? (
              <>
                <Divider>原内容与结构化草稿</Divider>
                <div className="optimization-comparison">
                  <section>
                    <span className="comparison-label">当前商品</span>
                    <Typography.Title level={5}>
                      {optimization.source.title}
                    </Typography.Title>
                    <Typography.Paragraph>
                      {optimization.source.description}
                    </Typography.Paragraph>
                    <Space wrap>
                      {optimization.source.sellingPoints.map((point) => (
                        <Tag key={point}>{point}</Tag>
                      ))}
                    </Space>
                  </section>
                  <section className="draft-panel">
                    <span className="comparison-label">AI 草稿</span>
                    <Typography.Title level={5}>{draft.title}</Typography.Title>
                    <Typography.Paragraph>
                      {draft.description}
                    </Typography.Paragraph>
                    <Space wrap>
                      {draft.sellingPoints.map((point) => (
                        <Tag color="cyan" key={point}>
                          {point}
                        </Tag>
                      ))}
                    </Space>
                  </section>
                </div>

                <Divider>风险与建议</Divider>
                <Alert
                  type={draft.complianceRisks.length ? 'warning' : 'success'}
                  showIcon
                  message={
                    draft.complianceRisks.length
                      ? '存在需要人工核实的合规风险'
                      : '未发现明确风险'
                  }
                  description={draft.complianceRisks.join('；')}
                />
                <ul className="optimization-suggestions">
                  {draft.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
                <div className="confidence-row">
                  <span>AI 置信度</span>
                  <Progress
                    percent={Math.round(draft.confidence * 100)}
                    size="small"
                  />
                </div>

                {optimization.status === 'DRAFT' ? (
                  <div className="optimization-actions">
                    <Button onClick={() => void reject()}>拒绝草稿</Button>
                    <Popconfirm
                      title="确认写回正式商品？"
                      description="系统会保存前后版本和审计记录；若商品已被其他人修改，本次写回将被拒绝。"
                      okText="确认写回"
                      cancelText="继续检查"
                      onConfirm={() => void apply()}
                    >
                      <Button type="primary">人工确认并写回</Button>
                    </Popconfirm>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </Spin>
    </Drawer>
  )
}
