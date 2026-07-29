import type { MerchantSummary } from '@cross-border/shared'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'

import {
  createMerchant,
  getMerchants,
  updateMerchant,
  type MerchantInput,
} from '../../api/commerce'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

export function MerchantsPage() {
  const token = useAppSelector((state) => state.auth.accessToken)
  const [form] = Form.useForm<MerchantInput>()
  const [merchants, setMerchants] = useState<MerchantSummary[]>([])
  const [editing, setEditing] = useState<MerchantSummary | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messageApi, messageContext] = message.useMessage()

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      setMerchants(await getMerchants(token))
      setError(null)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : '商家加载失败')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({
      code: '',
      name: '',
      defaultCurrency: 'USD',
    })
    setModalOpen(true)
  }

  const openEdit = (merchant: MerchantSummary) => {
    setEditing(merchant)
    form.setFieldsValue({
      code: merchant.code,
      name: merchant.name,
      defaultCurrency: merchant.defaultCurrency,
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!token) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await updateMerchant(token, editing.id, {
          name: values.name,
          defaultCurrency: values.defaultCurrency,
        })
      } else {
        await createMerchant(token, values)
      }
      setModalOpen(false)
      await load()
      void messageApi.success(editing ? '商家已更新' : '商家已创建')
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error ? saveError.message : '保存失败',
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (merchant: MerchantSummary) => {
    if (!token) return
    try {
      await updateMerchant(token, merchant.id, {
        status: merchant.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      })
      await load()
      void messageApi.success('商家状态已更新')
    } catch (updateError: unknown) {
      void messageApi.error(
        updateError instanceof Error ? updateError.message : '状态更新失败',
      )
    }
  }

  return (
    <main className="workspace-page merchants-page">
      {messageContext}
      <header className="workspace-header">
        <div>
          <span className="page-kicker">Merchant scope</span>
          <h1>商家管理</h1>
          <p>维护业务租户；商品、SKU 和审计数据都以商家为隔离边界。</p>
        </div>
        <Button type="primary" onClick={openCreate}>
          新建商家
        </Button>
      </header>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <div className="table-card">
        <Table<MerchantSummary>
          rowKey="id"
          loading={loading}
          pagination={false}
          dataSource={merchants}
          columns={[
            { title: '商家', dataIndex: 'name' },
            { title: '编码', dataIndex: 'code' },
            { title: '默认币种', dataIndex: 'defaultCurrency' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status: MerchantSummary['status']) => (
                <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>
                  {status === 'ACTIVE' ? '启用' : '停用'}
                </Tag>
              ),
            },
            {
              title: '操作',
              render: (_, merchant) => (
                <Space>
                  <Button type="link" onClick={() => openEdit(merchant)}>
                    编辑
                  </Button>
                  <Button
                    type="link"
                    danger={merchant.status === 'ACTIVE'}
                    onClick={() => void toggleStatus(merchant)}
                  >
                    {merchant.status === 'ACTIVE' ? '停用' : '启用'}
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={editing ? '编辑商家' : '新建商家'}
        open={modalOpen}
        confirmLoading={saving}
        onOk={() => void save()}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="商家编码"
            rules={[{ required: true }, { pattern: /^[A-Z0-9][A-Z0-9_-]+$/ }]}
          >
            <Input disabled={Boolean(editing)} placeholder="DEMO-EU" />
          </Form.Item>
          <Form.Item name="name" label="商家名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="defaultCurrency"
            label="默认币种"
            rules={[{ required: true }]}
          >
            <Select
              options={['USD', 'EUR', 'GBP', 'CNY'].map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  )
}
