import {
  AppstoreOutlined,
  BookOutlined,
  ClusterOutlined,
  FileDoneOutlined,
  GlobalOutlined,
  LineChartOutlined,
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
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { LanguageSwitch } from '../../components/language-switch/language-switch'
import { useBusinessContext } from '../../contexts/business-context'
import { logout } from '../../store/auth.slice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'

import './styles.css'

interface NavigationItem {
  to: string
  labelKey: string
  icon: ElementType
  end?: boolean
  roles?: RoleCode[]
}

interface NavigationGroup {
  id: string
  labelKey: string
  items: NavigationItem[]
}

const navigationGroups: NavigationGroup[] = [
  {
    id: 'overview',
    labelKey: 'nav.overview',
    items: [
      {
        to: '/',
        labelKey: 'nav.dashboard',
        icon: AppstoreOutlined,
        end: true,
      },
    ],
  },
  {
    id: 'commerce',
    labelKey: 'nav.commerce',
    items: [
      { to: '/orders', labelKey: 'nav.orders', icon: ShoppingCartOutlined },
      { to: '/products', labelKey: 'nav.products', icon: TagsOutlined },
      {
        to: '/stores',
        labelKey: 'nav.stores',
        icon: GlobalOutlined,
        roles: ['admin', 'operator'],
      },
      {
        to: '/imports',
        labelKey: 'nav.imports',
        icon: UploadOutlined,
        roles: ['admin', 'operator'],
      },
    ],
  },
  {
    id: 'ai',
    labelKey: 'nav.aiWorkspace',
    items: [
      {
        to: '/ai-chat',
        labelKey: 'nav.aiAssistant',
        icon: RobotOutlined,
        roles: ['admin', 'operator'],
      },
      {
        to: '/batch-tasks',
        labelKey: 'nav.batchTasks',
        icon: ClusterOutlined,
        roles: ['admin', 'operator'],
      },
      {
        to: '/ai-results',
        labelKey: 'nav.aiResults',
        icon: FileDoneOutlined,
        roles: ['admin', 'operator'],
      },
      {
        to: '/ai-quality',
        labelKey: 'nav.aiQuality',
        icon: LineChartOutlined,
        roles: ['admin', 'operator'],
      },
      {
        to: '/rule-documents',
        labelKey: 'nav.rules',
        icon: BookOutlined,
        roles: ['admin'],
      },
    ],
  },
  {
    id: 'administration',
    labelKey: 'nav.administration',
    items: [
      {
        to: '/merchants',
        labelKey: 'nav.merchants',
        icon: ShopOutlined,
        roles: ['admin'],
      },
      {
        to: '/users',
        labelKey: 'nav.users',
        icon: TeamOutlined,
        roles: ['admin'],
      },
    ],
  },
]

export function AppLayout() {
  const { t } = useTranslation()
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
            <span>{t('nav.brandSubtitle')}</span>
          </div>
        </div>
        <nav aria-label={t('nav.label')}>
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
                {t(group.labelKey)}
              </div>
              <div className="sidebar-nav-links">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink to={item.to} end={item.end} key={item.to}>
                      <Icon />
                      <span>{t(item.labelKey)}</span>
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
            aria-label={t('nav.logout')}
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => void handleLogout()}
          />
        </div>
      </aside>
      <section className="content-shell">
        <div className="business-context-bar">
          <Space wrap>
            <Typography.Text
              className="business-context-label"
              type="secondary"
            >
              {t('nav.context')}
            </Typography.Text>
            <Select
              aria-label={t('nav.currentMerchant')}
              className="business-context-merchant"
              value={merchantId || undefined}
              onChange={setMerchantId}
              options={merchants.map((merchant) => ({
                value: merchant.id,
                label: `${merchant.name} · ${merchant.code}`,
              }))}
            />
            <Select
              aria-label={t('nav.currentStore')}
              className="business-context-store"
              value={storeId || undefined}
              placeholder={t('nav.selectStore')}
              onChange={setStoreId}
              options={stores
                .filter((store) => store.status === 'ACTIVE')
                .map((store) => ({
                  value: store.id,
                  label: `${store.name} · ${store.market}`,
                }))}
            />
          </Space>
          <Typography.Text className="business-context-meta" type="secondary">
            {currentStore
              ? `${currentStore.platform} / ${currentStore.currency} / ${currentStore.locale}`
              : t('nav.noStore')}
          </Typography.Text>
          <LanguageSwitch compact />
        </div>
        <Outlet />
      </section>
    </div>
  )
}
