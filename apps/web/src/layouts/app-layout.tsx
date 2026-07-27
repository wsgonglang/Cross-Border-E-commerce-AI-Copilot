import {
  AppstoreOutlined,
  LogoutOutlined,
  RobotOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Avatar, Button } from 'antd'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { logout } from '../store/auth.slice'
import { useAppDispatch, useAppSelector } from '../store/hooks'

export function AppLayout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector((state) => state.auth.user)
  const isAdmin = user?.roles.includes('admin') ?? false

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
          <NavLink to="/ai-chat">
            <RobotOutlined />
            AI 对话
          </NavLink>
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
        <Outlet />
      </section>
    </div>
  )
}
