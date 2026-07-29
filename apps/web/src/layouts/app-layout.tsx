import {
  AppstoreOutlined,
  BookOutlined,
  ClusterOutlined,
  FileDoneOutlined,
  GlobalOutlined,
  LogoutOutlined,
  RobotOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { RoleCode } from '@cross-border/shared'
import { Avatar, Button, Select, Space, Typography } from 'antd'
import type { ElementType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useBusinessContext } from '../contexts/business-context'
import { logout } from '../store/auth.slice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

interface NavigationItem {
  to: string
  label: string
  icon: ElementType
  end?: boolean
  roles?: RoleCode[]
}

interface NavigationGroup {
  id: string
  label: string
  items: NavigationItem[]
}

const navigationGroups: NavigationGroup[] = [
  {
    id: 'overview',
    label: '总览',
    items: [
      {
        to: '/',
        label: '运营工作台',
        icon: AppstoreOutlined,
        end: true,
      },
    ],
  },
  {
    id: 'commerce',
    label: '业务运营',
    items: [
      { to: '/orders', label: '订单运营', icon: ShoppingCartOutlined },
      { to: '/products', label: '商品与 SKU', icon: TagsOutlined },
      {
        to: '/stores',
        label: '店铺与刊登',
        icon: GlobalOutlined,
        roles: ['admin', 'operator'],
      },
      {
        to: '/imports',
        label: '结构化导入',
        icon: UploadOutlined,
        roles: ['admin', 'operator'],
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI 工作空间',
    items: [
      {
        to: '/ai-chat',
        label: 'AI 运营助手',
        icon: RobotOutlined,
        roles: ['admin', 'operator'],
      },
      {
        to: '/batch-tasks',
        label: '批量 AI 任务',
        icon: ClusterOutlined,
        roles: ['admin', 'operator'],
      },
      {
        to: '/ai-results',
        label: 'AI 成果中心',
        icon: FileDoneOutlined,
        roles: ['admin', 'operator'],
      },
      {
        to: '/rule-documents',
        label: '规则知识库',
        icon: BookOutlined,
        roles: ['admin'],
      },
    ],
  },
  {
    id: 'administration',
    label: '系统管理',
    items: [
      {
        to: '/merchants',
        label: '商家管理',
        icon: ShopOutlined,
        roles: ['admin'],
      },
      {
        to: '/users',
        label: '用户与权限',
        icon: TeamOutlined,
        roles: ['admin'],
      },
    ],
  },
]

export function AppLayout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)
  const userRoles = user?.roles ?? []
  const visibleNavigationGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.roles || item.roles.some((role) => userRoles.includes(role)),
      ),
    }))
    .filter((group) => group.items.length > 0)
  const {
    merchants,
    stores,
    merchantId,
    storeId,
    currentStore,
    setMerchantId,
    setStoreId,
  } = useBusinessContext()

  const handleLogout = async () => {
    await dispatch(logout())
    await navigate('/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">CB</div>
          <div>
            <strong>AI Copilot</strong>
            <span>跨境电商运营台</span>
          </div>
        </div>
        <nav aria-label="主导航">
          {visibleNavigationGroups.map((group) => (
            <section
              className="sidebar-nav-group"
              aria-labelledby={`sidebar-group-${group.id}`}
              key={group.id}
            >
              <div
                className="sidebar-nav-heading"
                id={`sidebar-group-${group.id}`}
              >
                {group.label}
              </div>
              <div className="sidebar-nav-links">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink to={item.to} end={item.end} key={item.to}>
                      <Icon />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="sidebar-user">
          <Avatar>{user?.name.slice(0, 1)}</Avatar>
          <div>
            <strong>{user?.name}</strong>
            <span>{user?.roles.join(' · ')}</span>
          </div>
          <Button
            aria-label="退出登录"
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => void handleLogout()}
          />
        </div>
      </aside>
      <section className="content-shell">
        <div className="business-context-bar">
          <Space wrap>
            <Typography.Text type="secondary">业务上下文</Typography.Text>
            <Select
              aria-label="当前商家"
              value={merchantId || undefined}
              style={{ width: 210 }}
              onChange={setMerchantId}
              options={merchants.map((merchant) => ({
                value: merchant.id,
                label: `${merchant.name} · ${merchant.code}`,
              }))}
            />
            <Select
              aria-label="当前店铺"
              value={storeId || undefined}
              placeholder="选择店铺"
              style={{ width: 220 }}
              onChange={setStoreId}
              options={stores
                .filter((store) => store.status === 'ACTIVE')
                .map((store) => ({
                  value: store.id,
                  label: `${store.name} · ${store.market}`,
                }))}
            />
          </Space>
          <Typography.Text type="secondary">
            {currentStore
              ? `${currentStore.platform} / ${currentStore.currency} / ${currentStore.locale}`
              : '当前商家尚无可用店铺'}
          </Typography.Text>
        </div>
        <Outlet />
      </section>
    </div>
  )
}
