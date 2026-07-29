import type {
  MerchantSummary,
  RuleDocumentDetail,
  RuleDocumentScope,
  RuleDocumentStatus,
  RuleDocumentSummary,
  RuleSearchResult,
} from '@cross-border/shared'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'

import { getMerchants } from '../../api/commerce'
import {
  archiveRuleDocument,
  getRuleDocument,
  getRuleDocuments,
  importRuleDocument,
  searchRuleDocuments,
} from '../../api/rule-documents'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

interface ImportForm {
  title: string
  platform: string
  scope: RuleDocumentScope
  sourceUrl?: string
  content: string
}

const statusLabels: Record<RuleDocumentStatus, string> = {
  ACTIVE: '有效',
  ARCHIVED: '已归档',
}

export function RuleDocumentsPage() {
  const token = useAppSelector((state) => state.auth.accessToken)
  const [form] = Form.useForm<ImportForm>()
  const [merchants, setMerchants] = useState<MerchantSummary[]>([])
  const [merchantId, setMerchantId] = useState<string>()
  const [documents, setDocuments] = useState<RuleDocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [detail, setDetail] = useState<RuleDocumentDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<RuleSearchResult | null>(
    null,
  )
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

  const load = useCallback(async () => {
    if (!token || !merchantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setDocuments(await getRuleDocuments(token, merchantId))
      setError(null)
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error ? loadError.message : '规则文档加载失败',
      )
    } finally {
      setLoading(false)
    }
  }, [merchantId, token])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openImport = () => {
    form.setFieldsValue({
      title: '',
      platform: 'DEMO_MARKETPLACE',
      scope: 'MERCHANT',
      sourceUrl: '',
      content: '',
    })
    setImportOpen(true)
  }

  const saveImport = async () => {
    if (!token || !merchantId) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      const created = await importRuleDocument(token, merchantId, {
        ...values,
        sourceUrl: values.sourceUrl || undefined,
      })
      setImportOpen(false)
      setDetail(created)
      setDetailOpen(true)
      await load()
      void messageApi.success(`文档已切分为 ${created.chunkCount} 个引用块`)
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error ? saveError.message : '文档导入失败',
      )
    } finally {
      setSaving(false)
    }
  }

  const showDetail = async (documentId: string) => {
    if (!token || !merchantId) return
    try {
      setDetail(await getRuleDocument(token, merchantId, documentId))
      setDetailOpen(true)
    } catch (loadError: unknown) {
      void messageApi.error(
        loadError instanceof Error ? loadError.message : '文档加载失败',
      )
    }
  }

  const archive = async (documentId: string) => {
    if (!token || !merchantId) return
    try {
      await archiveRuleDocument(token, merchantId, documentId)
      await load()
      setSearchResult(null)
      void messageApi.success('规则文档已归档，不再参与检索')
    } catch (archiveError: unknown) {
      void messageApi.error(
        archiveError instanceof Error ? archiveError.message : '归档失败',
      )
    }
  }

  const search = async (query: string) => {
    if (!token || !merchantId || query.trim().length < 2) return
    setSearching(true)
    try {
      setSearchResult(
        await searchRuleDocuments(token, merchantId, query.trim()),
      )
    } catch (searchError: unknown) {
      void messageApi.error(
        searchError instanceof Error ? searchError.message : '规则检索失败',
      )
    } finally {
      setSearching(false)
    }
  }

  return (
    <main className="workspace-page">
      {messageContext}
      <header className="workspace-header">
        <div>
          <span className="page-kicker">Traceable rule knowledge</span>
          <h1>规则知识库</h1>
          <p>
            导入可追溯规则原文，按全局或商家范围切分检索，并验证 Agent
            实际引用的依据。
          </p>
        </div>
        <Button type="primary" onClick={openImport} disabled={!merchantId}>
          导入规则文档
        </Button>
      </header>

      <div className="catalog-toolbar rule-toolbar">
        <Select
          value={merchantId}
          placeholder="选择检索上下文商家"
          onChange={(value) => {
            setMerchantId(value)
            setSearchResult(null)
          }}
          options={merchants.map((merchant) => ({
            value: merchant.id,
            label: `${merchant.name} · ${merchant.code}`,
          }))}
        />
        <Input.Search
          enterButton="测试检索"
          loading={searching}
          placeholder="例如：充电器需要核对哪些认证？"
          onSearch={(value) => void search(value)}
        />
      </div>

      <Alert
        type="info"
        showIcon
        message="检索边界"
        description="当前商家只能检索全局文档和自己的商家文档。没有可靠命中时系统会明确返回信息不足，不让 AI 编造平台规则。"
      />
      {error ? <Alert type="error" showIcon message={error} /> : null}

      {searchResult ? (
        <Card
          className="rule-search-card"
          title={`检索结果 · ${searchResult.query}`}
        >
          <Alert
            type={searchResult.sufficient ? 'success' : 'warning'}
            showIcon
            message={
              searchResult.sufficient ? '找到可引用依据' : '规则信息不足'
            }
            description={searchResult.notice}
          />
          <List
            dataSource={searchResult.sources}
            locale={{ emptyText: '没有达到可靠阈值的引用' }}
            renderItem={(source) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Tag color="blue">[{source.citation}]</Tag>
                      <span>{source.title}</span>
                      <Tag>{source.platform}</Tag>
                      <Tag
                        color={source.scope === 'GLOBAL' ? 'purple' : 'cyan'}
                      >
                        {source.scope === 'GLOBAL' ? '全局' : '当前商家'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <>
                      <p>{source.excerpt}</p>
                      <Typography.Text type="secondary">
                        分块 {source.chunkId} · 相关度{' '}
                        {(source.score * 100).toFixed(1)}%
                      </Typography.Text>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      ) : null}

      <div className="table-card rule-document-table">
        <Table<RuleDocumentSummary>
          rowKey="id"
          loading={loading}
          pagination={false}
          dataSource={documents}
          columns={[
            {
              title: '文档',
              render: (_, document) => (
                <div>
                  <strong>{document.title}</strong>
                  <div className="muted-line">{document.platform}</div>
                </div>
              ),
            },
            {
              title: '作用域',
              dataIndex: 'scope',
              width: 110,
              render: (scope: RuleDocumentScope) => (
                <Tag color={scope === 'GLOBAL' ? 'purple' : 'cyan'}>
                  {scope === 'GLOBAL' ? '全局' : '当前商家'}
                </Tag>
              ),
            },
            {
              title: '分块',
              dataIndex: 'chunkCount',
              width: 80,
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (status: RuleDocumentStatus) => (
                <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>
                  {statusLabels[status]}
                </Tag>
              ),
            },
            {
              title: '导入时间',
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString(),
            },
            {
              title: '操作',
              width: 160,
              render: (_, document) => (
                <Space>
                  <Button
                    type="link"
                    onClick={() => void showDetail(document.id)}
                  >
                    原文
                  </Button>
                  {document.status === 'ACTIVE' ? (
                    <Button
                      type="link"
                      danger
                      onClick={() => {
                        Modal.confirm({
                          title: '归档规则文档？',
                          content:
                            '归档后该文档不会再参与检索，历史引用仍可追溯。',
                          okText: '确认归档',
                          okButtonProps: { danger: true },
                          cancelText: '返回',
                          onOk: () => archive(document.id),
                        })
                      }}
                    >
                      归档
                    </Button>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title="导入规则文档"
        open={importOpen}
        width={760}
        confirmLoading={saving}
        okText="导入并切分"
        onOk={() => void saveImport()}
        onCancel={() => setImportOpen(false)}
      >
        <Form form={form} layout="vertical">
          <div className="form-grid">
            <Form.Item
              name="title"
              label="文档标题"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="platform"
              label="平台标识"
              rules={[{ required: true }]}
            >
              <Input placeholder="DEMO_MARKETPLACE" />
            </Form.Item>
          </div>
          <Form.Item name="scope" label="作用域" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'MERCHANT', label: '仅当前商家' },
                { value: 'GLOBAL', label: '全部商家' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sourceUrl" label="来源地址">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item
            name="content"
            label="规则原文（Markdown 或纯文本）"
            rules={[{ required: true }, { min: 20 }, { max: 30_000 }]}
          >
            <Input.TextArea rows={12} showCount maxLength={30_000} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={detail?.title ?? '规则原文'}
        width={720}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {detail ? (
          <>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="平台">
                {detail.platform}
              </Descriptions.Item>
              <Descriptions.Item label="作用域">
                {detail.scope === 'GLOBAL' ? '全局' : '当前商家'}
              </Descriptions.Item>
              <Descriptions.Item label="分块数量">
                {detail.chunkCount}
              </Descriptions.Item>
              <Descriptions.Item label="内容哈希">
                <Typography.Text code>{detail.contentHash}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="来源">
                {detail.sourceUrl ? (
                  <Typography.Link
                    href={detail.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {detail.sourceUrl}
                  </Typography.Link>
                ) : (
                  '未提供'
                )}
              </Descriptions.Item>
            </Descriptions>
            <pre className="rule-document-content">{detail.content}</pre>
          </>
        ) : null}
      </Drawer>
    </main>
  )
}
