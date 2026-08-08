import type { RoleCode, UserStatus, UserSummary } from '@cross-border/shared'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createUser, deleteUser, getUsers, updateUser } from '../../api/auth'
import { useBusinessContext } from '../../contexts/business-context'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

const roleLabels: Record<RoleCode, string> = {
  admin: '管理员',
  operator: '运营人员',
  viewer: '只读用户',
}

interface UserFormValues {
  email: string
  name: string
  password?: string
  roles: RoleCode[]
  merchantIds: string[]
  status: UserStatus
}

export function UsersPage() {
  const accessToken = useAppSelector((state) => state.auth.accessToken) ?? ''
  const currentUser = useAppSelector((state) => state.auth.user)
  const { merchants } = useBusinessContext()
  const [form] = Form.useForm<UserFormValues>()
  const [users, setUsers] = useState<UserSummary[]>([])
  const [editing, setEditing] = useState<UserSummary | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messageApi, messageContext] = message.useMessage()

  const merchantNames = useMemo(
    () => new Map(merchants.map((merchant) => [merchant.id, merchant.name])),
    [merchants],
  )

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      setUsers(await getUsers(accessToken))
      setError(null)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : '用户加载失败')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({
      email: '',
      name: '',
      password: '',
      roles: ['operator'],
      merchantIds: merchants[0] ? [merchants[0].id] : [],
      status: 'ACTIVE',
    })
    setModalOpen(true)
  }

  const openEdit = (user: UserSummary) => {
    setEditing(user)
    form.setFieldsValue({
      email: user.email,
      name: user.name,
      password: '',
      roles: user.roles,
      merchantIds: user.merchantIds,
      status: user.status,
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!accessToken) return
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await updateUser(accessToken, editing.id, {
          email: values.email,
          name: values.name,
          roles: values.roles,
          merchantIds: values.merchantIds,
          status: values.status,
          ...(values.password ? { password: values.password } : {}),
        })
      } else {
        await createUser(accessToken, {
          email: values.email,
          name: values.name,
          password: values.password ?? '',
          roles: values.roles,
          merchantIds: values.merchantIds,
        })
      }
      setModalOpen(false)
      await load()
      void messageApi.success(editing ? '用户已更新' : '用户已创建')
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error ? saveError.message : '用户保存失败',
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (user: UserSummary) => {
    if (!accessToken) return
    try {
      await updateUser(accessToken, user.id, {
        status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      })
      await load()
      void messageApi.success(
        user.status === 'ACTIVE' ? '用户已停用' : '用户已启用',
      )
    } catch (updateError: unknown) {
      void messageApi.error(
        updateError instanceof Error ? updateError.message : '状态更新失败',
      )
    }
  }

  const remove = async (user: UserSummary) => {
    if (!accessToken) return
    try {
      await deleteUser(accessToken, user.id)
      await load()
      void messageApi.success('用户已删除')
    } catch (deleteError: unknown) {
      void messageApi.error(
        deleteError instanceof Error ? deleteError.message : '用户删除失败',
      )
    }
  }

  return (
    <main className="workspace-page users-page">
      {messageContext}
      <header className="workspace-header">
        <div>
          <span className="page-kicker">Admin only</span>
          <h1>用户与权限</h1>
          <p>创建成员、分配角色与商家范围，并管理账号启停状态。</p>
        </div>
        <Button
          type="primary"
          onClick={openCreate}
          disabled={!merchants.length}
        >
          新增用户
        </Button>
      </header>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <div className="table-card">
        <Table<UserSummary>
          rowKey="id"
          loading={loading}
          pagination={false}
          dataSource={users}
          scroll={{ x: 920 }}
          columns={[
            {
              title: '姓名',
              dataIndex: 'name',
              render: (name: string, user) => (
                <Space size={6}>
                  <span>{name}</span>
                  {user.id === currentUser?.id ? (
                    <Tag color="blue">当前账号</Tag>
                  ) : null}
                </Space>
              ),
            },
            { title: '邮箱', dataIndex: 'email' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status: UserStatus) => (
                <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>
                  {status === 'ACTIVE' ? '启用' : '停用'}
                </Tag>
              ),
            },
            {
              title: '角色',
              dataIndex: 'roles',
              render: (roles: RoleCode[]) =>
                roles.map((role) => (
                  <Tag key={role} color={role === 'admin' ? 'gold' : 'cyan'}>
                    {roleLabels[role]}
                  </Tag>
                )),
            },
            {
              title: '可访问商家',
              dataIndex: 'merchantIds',
              render: (merchantIds: string[]) =>
                merchantIds.map((merchantId) => (
                  <Tag key={merchantId}>
                    {merchantNames.get(merchantId) ?? merchantId}
                  </Tag>
                )),
            },
            {
              title: '操作',
              fixed: 'right',
              width: 210,
              render: (_, user) => {
                const isSelf = user.id === currentUser?.id
                return (
                  <Space size={4}>
                    <Button type="link" onClick={() => openEdit(user)}>
                      编辑
                    </Button>
                    <Tooltip
                      title={isSelf ? '不能停用当前登录用户' : undefined}
                    >
                      <Button
                        type="link"
                        danger={user.status === 'ACTIVE'}
                        disabled={isSelf}
                        onClick={() => void toggleStatus(user)}
                      >
                        {user.status === 'ACTIVE' ? '停用' : '启用'}
                      </Button>
                    </Tooltip>
                    <Popconfirm
                      title="删除该用户？"
                      description="删除后账号立即失效，历史业务与审计记录仍会保留。"
                      okText="确认删除"
                      cancelText="取消"
                      disabled={isSelf}
                      onConfirm={() => void remove(user)}
                    >
                      <Tooltip
                        title={isSelf ? '不能删除当前登录用户' : undefined}
                      >
                        <Button type="link" danger disabled={isSelf}>
                          删除
                        </Button>
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                )
              },
            },
          ]}
        />
      </div>

      <Modal
        title={editing ? '编辑用户' : '新增用户'}
        open={modalOpen}
        confirmLoading={saving}
        okText="保存"
        onOk={() => void save()}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true }, { type: 'email' }]}
          >
            <Input maxLength={191} />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? '重置密码' : '初始密码'}
            extra={
              editing ? '留空表示不修改；修改后现有刷新令牌会失效。' : undefined
            }
            rules={[
              { required: !editing, message: '请输入初始密码' },
              { min: 8, message: '密码至少 8 位' },
              { max: 72, message: '密码最多 72 位' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="roles" label="角色" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              options={(Object.keys(roleLabels) as RoleCode[]).map((value) => ({
                value,
                label: roleLabels[value],
              }))}
            />
          </Form.Item>
          <Form.Item
            name="merchantIds"
            label="可访问商家"
            rules={[{ required: true }]}
          >
            <Select
              mode="multiple"
              options={merchants.map((merchant) => ({
                value: merchant.id,
                label: `${merchant.name} · ${merchant.code}`,
              }))}
            />
          </Form.Item>
          {editing ? (
            <Form.Item
              name="status"
              label="账号状态"
              rules={[{ required: true }]}
            >
              <Select
                disabled={editing.id === currentUser?.id}
                options={[
                  { value: 'ACTIVE', label: '启用' },
                  { value: 'DISABLED', label: '停用' },
                ]}
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </main>
  )
}
