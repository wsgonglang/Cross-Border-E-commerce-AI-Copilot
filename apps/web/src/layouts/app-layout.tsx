import {
  AppstoreOutlined,
  BookOutlined,
  ClusterOutlined,
  LogoutOutlined,
  RobotOutlined,
  FileDoneOutlined,
  GlobalOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Select, Space, Typography } from 'antd'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { logout } from '../store/auth.slice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { useBusinessContext } from '../contexts/business-context'

export function AppLayout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)
  const isAdmin = user?.roles.includes('admin') ?? false
  const canUseAi =
    user?.roles.some((role) => role === 'admin' || role === 'operator') ?? false
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
          <NavLink to="/" end>
            <AppstoreOutlined />
            工作台
          </NavLink>
          {canUseAi ? (
            <>
              <NavLink to="/ai-chat">
                <RobotOutlined />
                AI 运营助手
              </NavLink>
              <NavLink to="/batch-tasks">
                <ClusterOutlined />
                批量 AI 任务
              </NavLink>
              <NavLink to="/ai-results">
                <FileDoneOutlined />
                AI 成果中心
              </NavLink>
              <NavLink to="/stores">
                <GlobalOutlined />
                店铺与刊登
              </NavLink>
            </>
          ) : null}
          <NavLink to="/orders">
            <ShoppingCartOutlined />
            订单
          </NavLink>
          <NavLink to="/products">
            <TagsOutlined />
            商品与 SKU
          </NavLink>
          {isAdmin ? (
            <>
              <NavLink to="/merchants">
                <ShopOutlined />
                商家管理
              </NavLink>
              <NavLink to="/users">
                <TeamOutlined />
                用户与权限
              </NavLink>
              <NavLink to="/rule-documents">
                <BookOutlined />
                规则知识库
              </NavLink>
            </>
          ) : null}
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
