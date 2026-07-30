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
import { useTranslation } from 'react-i18next'

import {
  applyProductOptimization,
  createProductOptimization,
  getProductOptimizations,
  getProductOptimization,
  rejectProductOptimization,
} from '../../api/product-optimizations'

import './styles.css'

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
  const { t } = useTranslation()
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
            error instanceof Error
              ? error.message
              : t('optimization.loadFailed'),
          )
        }
      })
      .finally(() => {
        if (active) setLoadedProductId(product.id)
      })
    return () => {
      active = false
    }
  }, [initialOptimizationId, merchantId, messageApi, open, product, t, token])

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
      void messageApi.success(t('optimization.generated'))
    } catch (error: unknown) {
      void messageApi.error(
        error instanceof Error
          ? error.message
          : t('optimization.generateFailed'),
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
      void messageApi.success(t('optimization.applied'))
    } catch (error: unknown) {
      void messageApi.error(
        error instanceof Error ? error.message : t('optimization.applyFailed'),
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
      void messageApi.success(t('optimization.rejected'))
    } catch (error: unknown) {
      void messageApi.error(
        error instanceof Error ? error.message : t('optimization.rejectFailed'),
      )
    } finally {
      setLoading(false)
    }
  }

  const draft = optimization?.draft

  return (
    <Drawer
      title={t('optimization.title', { code: product?.code ?? '' })}
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
              label:
                value === 'en-US'
                  ? t('optimization.enUS')
                  : value === 'es-ES'
                    ? t('optimization.esES')
                    : t('optimization.ptBR'),
            }))}
          />
          <Button
            type="primary"
            loading={generating}
            onClick={() => void generate()}
          >
            {optimization
              ? t('optimization.regenerate')
              : t('optimization.generate')}
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
              { color: 'green', children: t('optimization.readContext') },
              { color: 'blue', children: t('optimization.generateCopy') },
              { color: 'gray', children: t('optimization.validate') },
            ]}
          />
        ) : null}

        {!optimization && !generating ? (
          <Empty description={t('optimization.empty')} />
        ) : null}

        {optimization ? (
          <>
            <Descriptions size="small" bordered column={3}>
              <Descriptions.Item label={t('common.status')}>
                <Tag
                  color={
                    optimization.status === 'APPLIED'
                      ? 'green'
                      : optimization.status === 'DRAFT'
                        ? 'blue'
                        : 'default'
                  }
                >
                  {t(`optimization.status.${optimization.status}`, {
                    defaultValue: optimization.status,
                  })}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('optimization.model')}>
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
                <Divider>{t('optimization.originalAndDraft')}</Divider>
                <div className="optimization-comparison">
                  <section>
                    <span className="comparison-label">
                      {t('optimization.currentProduct')}
                    </span>
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
                    <span className="comparison-label">
                      {t('optimization.aiDraft')}
                    </span>
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

                <Divider>{t('optimization.risksAndSuggestions')}</Divider>
                <Alert
                  type={draft.complianceRisks.length ? 'warning' : 'success'}
                  showIcon
                  message={
                    draft.complianceRisks.length
                      ? t('optimization.hasRisks')
                      : t('optimization.noRisks')
                  }
                  description={draft.complianceRisks.join('；')}
                />
                <ul className="optimization-suggestions">
                  {draft.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
                <div className="confidence-row">
                  <span>{t('optimization.confidence')}</span>
                  <Progress
                    percent={Math.round(draft.confidence * 100)}
                    size="small"
                  />
                </div>

                {optimization.status === 'DRAFT' ? (
                  <div className="optimization-actions">
                    <Button onClick={() => void reject()}>
                      {t('optimization.reject')}
                    </Button>
                    <Popconfirm
                      title={t('optimization.confirmTitle')}
                      description={t('optimization.confirmDescription')}
                      okText={t('optimization.confirm')}
                      cancelText={t('optimization.continueReview')}
                      onConfirm={() => void apply()}
                    >
                      <Button type="primary">{t('optimization.apply')}</Button>
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
