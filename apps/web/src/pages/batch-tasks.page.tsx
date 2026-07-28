import type {
  BatchTaskDetail,
  BatchTaskStatus,
  BatchTaskSummary,
  MerchantSummary,
  OptimizationLanguage,
  ProductSummary,
} from '@cross-border/shared'
import {
  Alert,
  Button,
  Drawer,
  Form,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  cancelBatchTask,
  createBatchTask,
  getBatchTask,
  getBatchTasks,
} from '../api/batch-tasks'
import { getMerchants, getProducts } from '../api/commerce'
import { useAppSelector } from '../store/hooks'

interface CreateTaskForm {
  productIds: string[]
  targetLanguage: OptimizationLanguage
}

const statusMeta: Record<BatchTaskStatus, { label: string; color: string }> = {
  PENDING: { label: '等待中', color: 'default' },
  RUNNING: { label: '处理中', color: 'processing' },
  COMPLETED: { label: '已完成', color: 'success' },
  PARTIAL_FAILED: { label: '部分失败', color: 'warning' },
  CANCELLED: { label: '已取消', color: 'default' },
}

const itemStatusMeta = {
  PENDING: { label: '等待中', color: 'default' },
  PROCESSING: { label: '处理中', color: 'processing' },
  COMPLETED: { label: '已生成草稿', color: 'success' },
  FAILED: { label: '失败', color: 'error' },
  CANCELLED: { label: '已取消', color: 'default' },
} as const

const languageOptions = [
  { value: 'en-US', label: '英语（美国）' },
  { value: 'es-ES', label: '西班牙语' },
  { value: 'pt-BR', label: '葡萄牙语（巴西）' },
]

function createIdempotencyKey(): string {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `batch-${randomPart}`
}

export function BatchTasksPage() {
  const token = useAppSelector((state) => state.auth.accessToken)
  const [form] = Form.useForm<CreateTaskForm>()
  const [merchants, setMerchants] = useState<MerchantSummary[]>([])
  const [merchantId, setMerchantId] = useState<string>()
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [tasks, setTasks] = useState<BatchTaskSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [detail, setDetail] = useState<BatchTaskDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [messageApi, messageContext] = message.useMessage()

  useEffect(() => {
    if (!token) return
    void getMerchants(token)
      .then((result) => {
        setMerchants(result)
        setMerchantId((current) => current ?? result[0]?.id)
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error ? loadError.message : '商家加载失败',
        )
      })
  }, [token])

  const loadProducts = useCallback(async () => {
    if (!token || !merchantId) return
    const result = await getProducts(token, merchantId, {
      page: 1,
      pageSize: 100,
    })
    setProducts(result.items.filter((product) => product.status !== 'ARCHIVED'))
  }, [merchantId, token])

  const loadTasks = useCallback(async () => {
    if (!token || !merchantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await getBatchTasks(token, merchantId, page, 20)
      setTasks(result.items)
      setTotal(result.total)
      setError(null)
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error ? loadError.message : '批量任务加载失败',
      )
    } finally {
      setLoading(false)
    }
  }, [merchantId, page, token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadProducts(), loadTasks()])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadProducts, loadTasks])

  const hasActiveTasks = useMemo(
    () =>
      tasks.some(
        (task) => task.status === 'PENDING' || task.status === 'RUNNING',
      ),
    [tasks],
  )

  useEffect(() => {
    if (!hasActiveTasks) return
    const timer = window.setInterval(() => {
      void loadTasks()
      if (
        detail &&
        ['PENDING', 'RUNNING'].includes(detail.status) &&
        token &&
        merchantId
      ) {
        void getBatchTask(token, merchantId, detail.id).then(setDetail)
      }
    }, 2000)
    return () => window.clearInterval(timer)
  }, [detail, hasActiveTasks, loadTasks, merchantId, token])

  const openCreate = () => {
    form.setFieldsValue({ productIds: [], targetLanguage: 'en-US' })
    setIdempotencyKey(createIdempotencyKey())
    setCreateOpen(true)
  }

  const saveTask = async () => {
    if (!token || !merchantId) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const created = await createBatchTask(token, merchantId, {
        ...values,
        idempotencyKey,
      })
      setCreateOpen(false)
      setDetail(created)
      setDetailOpen(true)
      await loadTasks()
      void messageApi.success('批量任务已入队')
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error ? saveError.message : '任务创建失败',
      )
    } finally {
      setSaving(false)
    }
  }

  const showDetail = async (taskId: string) => {
    if (!token || !merchantId) return
    try {
      setDetail(await getBatchTask(token, merchantId, taskId))
      setDetailOpen(true)
    } catch (loadError: unknown) {
      void messageApi.error(
        loadError instanceof Error ? loadError.message : '任务详情加载失败',
      )
    }
  }

  const cancelTask = async (taskId: string) => {
    if (!token || !merchantId) return
    try {
      const cancelled = await cancelBatchTask(token, merchantId, taskId)
      setDetail(cancelled)
      await loadTasks()
      void messageApi.success('未执行项目已取消')
    } catch (cancelError: unknown) {
      void messageApi.error(
        cancelError instanceof Error ? cancelError.message : '取消失败',
      )
    }
  }

  return (
    <main className="workspace-page">
      {messageContext}
      <header className="workspace-header">
        <div>
          <span className="page-kicker">Queued AI operations</span>
          <h1>批量 AI 任务</h1>
          <p>
            后台逐个生成商品优化草稿，支持进度、重试和取消；草稿仍需人工确认后才能写回商品。
          </p>
        </div>
        <Button type="primary" onClick={openCreate} disabled={!merchantId}>
          新建批量优化
        </Button>
      </header>

      <div className="catalog-toolbar batch-toolbar">
        <Select
          value={merchantId}
          placeholder="选择商家"
          onChange={(value) => {
            setMerchantId(value)
            setPage(1)
            setDetail(null)
          }}
          options={merchants.map((merchant) => ({
            value: merchant.id,
            label: `${merchant.name} · ${merchant.code}`,
          }))}
        />
      </div>

      <Alert
        type="info"
        showIcon
        message="安全边界"
        description="批量任务只创建可审阅草稿，不会自动修改正式商品。每个商品的最终应用仍走单商品人工确认与版本审计。"
      />
      {error ? <Alert type="error" showIcon message={error} /> : null}

      <div className="table-card batch-task-table">
        <Table<BatchTaskSummary>
          rowKey="id"
          loading={loading}
          dataSource={tasks}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: '目标语言',
              dataIndex: 'targetLanguage',
              width: 120,
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (value: BatchTaskStatus) => (
                <Tag color={statusMeta[value].color}>
                  {statusMeta[value].label}
                </Tag>
              ),
            },
            {
              title: '进度',
              width: 260,
              render: (_, task) => (
                <div className="batch-progress">
                  <Progress percent={task.progress} size="small" />
                  <span>
                    成功 {task.completedItems} · 失败 {task.failedItems} · 取消{' '}
                    {task.cancelledItems}
                  </span>
                </div>
              ),
            },
            {
              title: '操作',
              width: 170,
              render: (_, task) => (
                <Space>
                  <Button type="link" onClick={() => void showDetail(task.id)}>
                    详情
                  </Button>
                  {['PENDING', 'RUNNING'].includes(task.status) ? (
                    <Button
                      type="link"
                      danger
                      onClick={() => {
                        Modal.confirm({
                          title: '取消未执行项目？',
                          content:
                            '正在处理的项目可能仍会完成，等待中的项目会被取消。',
                          okText: '确认取消',
                          okButtonProps: { danger: true },
                          cancelText: '返回',
                          onOk: () => cancelTask(task.id),
                        })
                      }}
                    >
                      取消
                    </Button>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title="新建批量商品优化"
        open={createOpen}
        confirmLoading={saving}
        okText="创建并入队"
        onOk={() => void saveTask()}
        onCancel={() => setCreateOpen(false)}
      >
        <Alert
          type="warning"
          showIcon
          message="一次最多选择 20 个商品；失败项目会自动重试 3 次。"
        />
        <Form form={form} layout="vertical" className="batch-create-form">
          <Form.Item
            name="productIds"
            label="商品"
            rules={[{ required: true, message: '至少选择一个商品' }]}
          >
            <Select
              mode="multiple"
              maxCount={20}
              optionFilterProp="label"
              placeholder="选择需要生成优化草稿的商品"
              options={products.map((product) => ({
                value: product.id,
                label: `${product.code} · ${product.title}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="targetLanguage"
            label="目标语言"
            rules={[{ required: true }]}
          >
            <Select options={languageOptions} />
          </Form.Item>
          <Typography.Text type="secondary">
            重试本次提交时会复用同一幂等键，服务端不会创建重复任务。
          </Typography.Text>
        </Form>
      </Modal>

      <Drawer
        title="批量任务详情"
        width={720}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        extra={
          detail && ['PENDING', 'RUNNING'].includes(detail.status) ? (
            <Button danger onClick={() => void cancelTask(detail.id)}>
              取消未执行项目
            </Button>
          ) : null
        }
      >
        {detail ? (
          <>
            <div className="batch-detail-summary">
              <Tag color={statusMeta[detail.status].color}>
                {statusMeta[detail.status].label}
              </Tag>
              <Progress percent={detail.progress} />
              <span>
                共 {detail.totalItems} 个商品，已生成 {detail.completedItems}{' '}
                个草稿
              </span>
            </div>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detail.items}
              columns={[
                {
                  title: '商品',
                  render: (_, item) => (
                    <div>
                      <strong>{item.productCode}</strong>
                      <div>{item.productTitle}</div>
                    </div>
                  ),
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 125,
                  render: (value: keyof typeof itemStatusMeta) => (
                    <Tag color={itemStatusMeta[value].color}>
                      {itemStatusMeta[value].label}
                    </Tag>
                  ),
                },
                { title: '尝试次数', dataIndex: 'attempts', width: 90 },
                {
                  title: '结果',
                  width: 180,
                  render: (_, item) =>
                    item.optimizationId
                      ? `草稿 ${item.optimizationId.slice(0, 8)}`
                      : (item.error ?? '—'),
                },
              ]}
            />
          </>
        ) : null}
      </Drawer>
    </main>
  )
}
