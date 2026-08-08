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
import { useTranslation } from 'react-i18next'

import { createUser, deleteUser, getUsers, updateUser } from '../../api/auth'
import { useBusinessContext } from '../../contexts/business-context'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

const roleCodes: RoleCode[] = ['admin', 'operator', 'viewer']

interface UserFormValues {
  email: string
  name: string
  password?: string
  roles: RoleCode[]
  merchantIds: string[]
  status: UserStatus
}

export function UsersPage() {
  const { t } = useTranslation()
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
  const roleLabels = useMemo<Record<RoleCode, string>>(
    () => ({
      admin: t('users.rolesMap.admin'),
      operator: t('users.rolesMap.operator'),
      viewer: t('users.rolesMap.viewer'),
    }),
    [t],
  )

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
      setError(
        loadError instanceof Error ? loadError.message : t('users.loadFailed'),
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken, t])

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
      void messageApi.success(editing ? t('users.updated') : t('users.created'))
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error ? saveError.message : t('users.saveFailed'),
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
        user.status === 'ACTIVE' ? t('users.disabled') : t('users.enabled'),
      )
    } catch (updateError: unknown) {
      void messageApi.error(
        updateError instanceof Error
          ? updateError.message
          : t('users.statusUpdateFailed'),
      )
    }
  }

  const remove = async (user: UserSummary) => {
    if (!accessToken) return
    try {
      await deleteUser(accessToken, user.id)
      await load()
      void messageApi.success(t('users.deleted'))
    } catch (deleteError: unknown) {
      void messageApi.error(
        deleteError instanceof Error
          ? deleteError.message
          : t('users.deleteFailed'),
      )
    }
  }

  return (
    <main className="workspace-page users-page">
      {messageContext}
      <header className="workspace-header">
        <div>
          <span className="page-kicker">{t('users.kicker')}</span>
          <h1>{t('users.title')}</h1>
          <p>{t('users.description')}</p>
        </div>
        <Button
          type="primary"
          onClick={openCreate}
          disabled={!merchants.length}
        >
          {t('users.create')}
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
              title: t('users.name'),
              dataIndex: 'name',
              render: (name: string, user) => (
                <Space size={6}>
                  <span>{name}</span>
                  {user.id === currentUser?.id ? (
                    <Tag color="blue">{t('users.currentAccount')}</Tag>
                  ) : null}
                </Space>
              ),
            },
            { title: t('users.email'), dataIndex: 'email' },
            {
              title: t('common.status'),
              dataIndex: 'status',
              render: (status: UserStatus) => (
                <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>
                  {status === 'ACTIVE'
                    ? t('common.active')
                    : t('common.disabled')}
                </Tag>
              ),
            },
            {
              title: t('users.roles'),
              dataIndex: 'roles',
              render: (roles: RoleCode[]) =>
                roles.map((role) => (
                  <Tag key={role} color={role === 'admin' ? 'gold' : 'cyan'}>
                    {roleLabels[role]}
                  </Tag>
                )),
            },
            {
              title: t('users.merchants'),
              dataIndex: 'merchantIds',
              render: (merchantIds: string[]) =>
                merchantIds.map((merchantId) => (
                  <Tag key={merchantId}>
                    {merchantNames.get(merchantId) ?? merchantId}
                  </Tag>
                )),
            },
            {
              title: t('common.actions'),
              fixed: 'right',
              width: 210,
              render: (_, user) => {
                const isSelf = user.id === currentUser?.id
                return (
                  <Space size={4}>
                    <Button type="link" onClick={() => openEdit(user)}>
                      {t('common.edit')}
                    </Button>
                    <Tooltip
                      title={isSelf ? t('users.cannotDisableSelf') : undefined}
                    >
                      <Button
                        type="link"
                        danger={user.status === 'ACTIVE'}
                        disabled={isSelf}
                        onClick={() => void toggleStatus(user)}
                      >
                        {user.status === 'ACTIVE'
                          ? t('common.disable')
                          : t('common.enable')}
                      </Button>
                    </Tooltip>
                    <Popconfirm
                      title={t('users.deleteTitle')}
                      description={t('users.deleteDescription')}
                      okText={t('users.confirmDelete')}
                      cancelText={t('common.cancel')}
                      disabled={isSelf}
                      onConfirm={() => void remove(user)}
                    >
                      <Tooltip
                        title={isSelf ? t('users.cannotDeleteSelf') : undefined}
                      >
                        <Button type="link" danger disabled={isSelf}>
                          {t('users.delete')}
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
        title={editing ? t('users.edit') : t('users.create')}
        open={modalOpen}
        confirmLoading={saving}
        okText={t('users.save')}
        onOk={() => void save()}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('users.name')}
            rules={[{ required: true }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('users.email')}
            rules={[{ required: true }, { type: 'email' }]}
          >
            <Input maxLength={191} />
          </Form.Item>
          <Form.Item
            name="password"
            label={
              editing ? t('users.resetPassword') : t('users.initialPassword')
            }
            extra={editing ? t('users.passwordEditHint') : undefined}
            rules={[
              { required: !editing, message: t('users.passwordRequired') },
              { min: 8, message: t('users.passwordMin') },
              { max: 72, message: t('users.passwordMax') },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="roles"
            label={t('users.roles')}
            rules={[{ required: true }]}
          >
            <Select
              mode="multiple"
              options={roleCodes.map((value) => ({
                value,
                label: roleLabels[value],
              }))}
            />
          </Form.Item>
          <Form.Item
            name="merchantIds"
            label={t('users.merchants')}
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
              label={t('users.accountStatus')}
              rules={[{ required: true }]}
            >
              <Select
                disabled={editing.id === currentUser?.id}
                options={[
                  { value: 'ACTIVE', label: t('common.active') },
                  { value: 'DISABLED', label: t('common.disabled') },
                ]}
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </main>
  )
}
