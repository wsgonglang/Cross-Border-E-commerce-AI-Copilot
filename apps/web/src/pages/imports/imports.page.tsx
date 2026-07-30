import type {
  ImportFieldKey,
  ImportFileAnalysis,
  ImportJobSummary,
  ImportMapping,
  ImportMode,
  ImportPreview,
} from '@cross-border/shared'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  InputNumber,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'

import {
  DownloadOutlined,
  InboxOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useBusinessContext } from '../../contexts/business-context'
import {
  analyzeImportFile,
  cancelImportJob,
  createImportJob,
  downloadImportFailures,
  previewImport,
} from '../../api/imports'
import {
  useImportJobQuery,
  useImportJobsQuery,
} from '../../queries/operations.queries'
import { queryKeys } from '../../queries/query-keys'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

const IMPORT_FIELD_KEYS = [
  'productCode',
  'title',
  'description',
  'language',
  'skuCode',
  'skuName',
  'price',
  'currency',
  'stock',
] as const

const fieldLabels: Record<ImportFieldKey, string> = {
  productCode: '商品编码',
  title: '商品标题',
  description: '商品描述',
  language: '语言',
  skuCode: 'SKU 编码',
  skuName: 'SKU 名称',
  price: '价格',
  currency: '币种',
  stock: '库存',
}

const aliases: Record<ImportFieldKey, string[]> = {
  productCode: ['productcode', 'product_code', '商品编码'],
  title: ['title', '商品标题', '标题'],
  description: ['description', '商品描述', '描述'],
  language: ['language', '语言'],
  skuCode: ['skucode', 'sku_code', 'sku编码'],
  skuName: ['skuname', 'sku_name', 'sku名称'],
  price: ['price', '价格'],
  currency: ['currency', '币种'],
  stock: ['stock', '库存'],
}

const statusColor: Record<string, string> = {
  PENDING: 'gold',
  RUNNING: 'processing',
  COMPLETED: 'green',
  PARTIAL_FAILED: 'red',
  CANCELLED: 'default',
  VALIDATION_FAILED: 'red',
  PROCESSING: 'processing',
  FAILED: 'red',
}

function inferMapping(headers: string[]): Partial<ImportMapping> {
  return Object.fromEntries(
    IMPORT_FIELD_KEYS.flatMap((key) => {
      const match = headers.find((header) =>
        aliases[key].includes(header.toLowerCase().replaceAll(' ', '')),
      )
      return match ? [[key, match]] : []
    }),
  )
}

export function ImportsPage() {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const { merchantId } = useBusinessContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [messageApi, contextHolder] = message.useMessage()
  const [file, setFile] = useState<File>()
  const [headerRow, setHeaderRow] = useState(1)
  const [analysis, setAnalysis] = useState<ImportFileAnalysis>()
  const [worksheet, setWorksheet] = useState<string>()
  const [mapping, setMapping] = useState<Partial<ImportMapping>>({})
  const [preview, setPreview] = useState<ImportPreview>()
  const [mode, setMode] = useState<ImportMode>('DRAFT_ONLY')
  const [targetLanguage, setTargetLanguage] = useState('en-US')
  const [detailJobId, setDetailJobId] = useState<string | undefined>(
    searchParams.get('jobId') ?? undefined,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const jobsQuery = useImportJobsQuery(token, merchantId)
  const detailQuery = useImportJobQuery(token, merchantId, detailJobId)
  const jobs = jobsQuery.data?.items ?? []
  const detail = detailQuery.data
  const queryError = jobsQuery.error ?? detailQuery.error
  const displayedError =
    error ?? (queryError instanceof Error ? queryError.message : undefined)

  const currentSheet = analysis?.worksheets.find(
    (sheet) => sheet.name === worksheet,
  )
  const completeMapping = useMemo(
    () =>
      IMPORT_FIELD_KEYS.every((key) => Boolean(mapping[key])) &&
      (mapping as ImportMapping),
    [mapping],
  )

  const run = async (action: () => Promise<void>) => {
    setLoading(true)
    setError(undefined)
    try {
      await action()
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const analyze = () =>
    run(async () => {
      if (!file || !merchantId) throw new Error('请先选择 CSV 或 XLSX 文件')
      const result = await analyzeImportFile(token, merchantId, file, headerRow)
      setAnalysis(result)
      const first = result.worksheets[0]
      setWorksheet(first?.name)
      setMapping(inferMapping(first?.headers ?? []))
      setPreview(undefined)
    })

  const previewRows = () =>
    run(async () => {
      if (!file || !merchantId || !completeMapping)
        throw new Error('请完成文件分析和全部字段映射')
      setPreview(
        await previewImport(token, merchantId, file, {
          worksheet,
          headerRow,
          mapping: completeMapping,
        }),
      )
    })

  const submit = () =>
    run(async () => {
      if (!file || !merchantId || !completeMapping || !preview)
        throw new Error('请先完成预览校验')
      const job = await createImportJob(token, merchantId, file, {
        worksheet,
        headerRow,
        mapping: completeMapping,
        mode,
        targetLanguage: mode === 'DRAFT_AND_AI' ? targetLanguage : undefined,
        idempotencyKey: crypto.randomUUID(),
      })
      queryClient.setQueryData(queryKeys.importJob(merchantId, job.id), job)
      setDetailJobId(job.id)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.importJobsRoot(merchantId),
      })
      messageApi.success('结构化导入任务已创建')
    })

  const openJob = (jobId: string) => setDetailJobId(jobId)

  return (
    <main className="workspace-page">
      {contextHolder}
      <header className="workspace-header">
        <div>
          <span className="page-kicker">Structured import center</span>
          <h1>结构化导入中心</h1>
          <p>CSV/XLSX 先映射和预览，确认后再由 Worker 导入商品草稿与 SKU。</p>
        </div>
      </header>
      {displayedError ? (
        <Alert type="error" showIcon message={displayedError} />
      ) : null}

      <Card title="1. 文件与表头" className="import-card">
        <Space wrap>
          <label className="native-file-picker">
            <UploadOutlined /> 选择 CSV/XLSX
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) => {
                setFile(event.target.files?.[0])
                setAnalysis(undefined)
                setPreview(undefined)
              }}
            />
          </label>
          <Typography.Text>{file?.name ?? '尚未选择文件'}</Typography.Text>
          <InputNumber
            min={1}
            max={20}
            value={headerRow}
            addonBefore="表头行"
            onChange={(value) => setHeaderRow(value ?? 1)}
          />
          <Button loading={loading} onClick={() => void analyze()}>
            分析文件
          </Button>
        </Space>
        {analysis ? (
          <Alert
            className="import-analysis-alert"
            type="info"
            showIcon
            message={`SHA-256：${analysis.fileHash}`}
            description="分析与预览不会写入商品数据；XLSX 公式、宏和外部链接不会执行。"
          />
        ) : null}
      </Card>

      {analysis ? (
        <Card title="2. 工作表与字段映射" className="import-card">
          <Space wrap className="import-mapping-toolbar">
            <Select
              className="import-worksheet-select"
              value={worksheet}
              options={analysis.worksheets.map((sheet) => ({
                value: sheet.name,
                label: `${sheet.name} · ${sheet.rowCount} 行`,
              }))}
              onChange={(value) => {
                setWorksheet(value)
                const sheet = analysis.worksheets.find(
                  (item) => item.name === value,
                )
                setMapping(inferMapping(sheet?.headers ?? []))
                setPreview(undefined)
              }}
            />
          </Space>
          <Row gutter={[16, 16]}>
            {IMPORT_FIELD_KEYS.map((key) => (
              <Col xs={24} sm={12} lg={8} key={key}>
                <Typography.Text type="secondary">
                  {fieldLabels[key]}
                </Typography.Text>
                <Select
                  className="import-mapping-select"
                  value={mapping[key]}
                  placeholder="选择表头"
                  options={currentSheet?.headers.map((header) => ({
                    value: header,
                    label: header,
                  }))}
                  onChange={(value) => {
                    setMapping((current) => ({ ...current, [key]: value }))
                    setPreview(undefined)
                  }}
                />
              </Col>
            ))}
          </Row>
          <Button
            type="primary"
            className="import-preview-button"
            disabled={!completeMapping}
            loading={loading}
            onClick={() => void previewRows()}
          >
            预览并校验
          </Button>
        </Card>
      ) : null}

      {preview ? (
        <Card title="3. 预览、风险与提交" className="import-card">
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="总行数" value={preview.totalRows} />
            </Col>
            <Col span={6}>
              <Statistic
                className="import-stat-valid"
                title="有效"
                value={preview.validRows}
              />
            </Col>
            <Col span={6}>
              <Statistic
                className="import-stat-invalid"
                title="无效"
                value={preview.invalidRows}
              />
            </Col>
            <Col span={6}>
              <Statistic title="含警告" value={preview.warningRows} />
            </Col>
          </Row>
          <Table
            size="small"
            rowKey="rowNumber"
            dataSource={preview.rows}
            pagination={{ pageSize: 8 }}
            columns={[
              { title: '行', dataIndex: 'rowNumber', width: 70 },
              {
                title: '商品编码',
                render: (_, row) => row.normalized?.productCode,
              },
              { title: 'SKU', render: (_, row) => row.normalized?.skuCode },
              {
                title: '校验',
                render: (_, row) =>
                  row.valid ? (
                    <Tag color="green">有效</Tag>
                  ) : (
                    <Tag color="red">无效</Tag>
                  ),
              },
              {
                title: '问题/风险',
                render: (_, row) =>
                  [...row.errors, ...row.warnings].join('；') || '-',
              },
            ]}
          />
          <Space wrap>
            <Radio.Group
              value={mode}
              onChange={(event) => setMode(event.target.value as ImportMode)}
            >
              <Radio.Button value="DRAFT_ONLY">仅导入商品草稿</Radio.Button>
              <Radio.Button value="DRAFT_AND_AI">
                导入后创建 AI 优化
              </Radio.Button>
            </Radio.Group>
            {mode === 'DRAFT_AND_AI' ? (
              <Select
                value={targetLanguage}
                options={[
                  { value: 'en-US', label: '英语' },
                  { value: 'es-ES', label: '西班牙语' },
                  { value: 'pt-BR', label: '葡萄牙语' },
                ]}
                onChange={setTargetLanguage}
              />
            ) : null}
            <Button
              type="primary"
              icon={<InboxOutlined />}
              disabled={preview.validRows === 0}
              loading={loading}
              onClick={() => void submit()}
            >
              创建异步导入任务
            </Button>
          </Space>
        </Card>
      ) : null}

      <Card title="导入任务" className="import-card">
        <Table<ImportJobSummary>
          rowKey="id"
          dataSource={jobs}
          pagination={false}
          columns={[
            { title: '文件', dataIndex: 'fileName' },
            { title: '模式', dataIndex: 'mode', width: 150 },
            {
              title: '进度',
              width: 220,
              render: (_, job) => (
                <Progress
                  percent={Math.round(
                    ((job.completedItems +
                      job.failedItems +
                      job.cancelledItems) /
                      Math.max(1, job.totalItems)) *
                      100,
                  )}
                  size="small"
                />
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 140,
              render: (value: string) => (
                <Tag color={statusColor[value]}>{value}</Tag>
              ),
            },
            {
              title: '操作',
              width: 120,
              render: (_, job) => (
                <Button type="link" onClick={() => openJob(job.id)}>
                  详情
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title="导入任务详情"
        width={820}
        open={Boolean(detail)}
        onClose={() => setDetailJobId(undefined)}
        extra={
          detail ? (
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={() =>
                  merchantId &&
                  void downloadImportFailures(token, merchantId, detail.id)
                }
              >
                失败明细
              </Button>
              {['PENDING', 'RUNNING'].includes(detail.status) ? (
                <Button
                  danger
                  onClick={() =>
                    merchantId &&
                    void cancelImportJob(token, merchantId, detail.id).then(
                      async (cancelled) => {
                        queryClient.setQueryData(
                          queryKeys.importJob(merchantId, detail.id),
                          cancelled,
                        )
                        await queryClient.invalidateQueries({
                          queryKey: queryKeys.importJobsRoot(merchantId),
                        })
                      },
                    )
                  }
                >
                  取消未执行项
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      >
        {detail ? (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="文件">
                {detail.fileName}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[detail.status]}>{detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="有效/无效">
                {detail.validItems} / {detail.invalidItems}
              </Descriptions.Item>
              <Descriptions.Item label="完成/失败">
                {detail.completedItems} / {detail.failedItems}
              </Descriptions.Item>
            </Descriptions>
            <Table
              className="import-detail-table"
              size="small"
              rowKey="id"
              dataSource={detail.items}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '行', dataIndex: 'rowNumber', width: 60 },
                { title: '商品', dataIndex: 'productCode' },
                { title: 'SKU', dataIndex: 'skuCode' },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (value: string) => (
                    <Tag color={statusColor[value]}>{value}</Tag>
                  ),
                },
                { title: '错误', dataIndex: 'error' },
                {
                  title: '结果',
                  render: (_, item) =>
                    item.productId ? (
                      <Button
                        type="link"
                        onClick={() =>
                          void navigate(
                            `/products?productId=${item.productId}&keyword=${item.productCode ?? ''}`,
                          )
                        }
                      >
                        查看商品
                      </Button>
                    ) : (
                      '-'
                    ),
                },
              ]}
            />
          </>
        ) : null}
      </Drawer>
    </main>
  )
}
