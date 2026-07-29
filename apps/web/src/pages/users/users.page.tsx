import type { AuthenticatedUser } from '@cross-border/shared'
import { Alert, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'

import { getUsers } from '../../api/auth'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

const roleLabels = {
  admin: '管理员',
  operator: '运营人员',
  viewer: '只读用户',
} as const

export function UsersPage() {
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const [users, setUsers] = useState<AuthenticatedUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const loadUsers = async () => {
      try {
        setUsers(await getUsers(accessToken))
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error ? loadError.message : '用户加载失败',
        )
      } finally {
        setLoading(false)
      }
    }

    void loadUsers()
  }, [accessToken])

  return (
    <main className="workspace-page users-page">
      <header className="workspace-header">
        <div>
          <span className="page-kicker">Admin only</span>
          <h1>用户与权限</h1>
          <p>该页面和对应 API 都只允许管理员访问。</p>
        </div>
      </header>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <div className="table-card">
        <Table<AuthenticatedUser>
          rowKey="id"
          loading={loading}
          pagination={false}
          dataSource={users}
          columns={[
            {
              title: '姓名',
              dataIndex: 'name',
            },
            {
              title: '邮箱',
              dataIndex: 'email',
            },
            {
              title: '角色',
              dataIndex: 'roles',
              render: (roles: AuthenticatedUser['roles']) =>
                roles.map((role) => (
                  <Tag key={role} color={role === 'admin' ? 'gold' : 'cyan'}>
                    {roleLabels[role]}
                  </Tag>
                )),
            },
          ]}
        />
      </div>
    </main>
  )
}
