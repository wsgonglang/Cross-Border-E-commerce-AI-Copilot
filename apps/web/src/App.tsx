import { Spin } from 'antd'
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthenticatedRoute } from './components/authenticated-route'
import { RoleRoute } from './components/role-route'
import { AppLayout } from './layouts/app-layout'
import { AiChatPage } from './pages/ai-chat.page'
import { DashboardPage } from './pages/dashboard.page'
import { ForbiddenPage } from './pages/forbidden.page'
import { LoginPage } from './pages/login.page'
import { MerchantsPage } from './pages/merchants.page'
import { OrdersPage } from './pages/orders.page'
import { ProductsPage } from './pages/products.page'
import { UsersPage } from './pages/users.page'
import { restoreSession } from './store/auth.slice'
import { useAppDispatch, useAppSelector } from './store/hooks'

export function App() {
  const dispatch = useAppDispatch()
  const status = useAppSelector((state) => state.auth.status)

  useEffect(() => {
    void dispatch(restoreSession())
  }, [dispatch])

  if (status === 'checking') {
    return (
      <main className="session-loading">
        <div className="brand-mark">CB</div>
        <Spin size="large" />
        <span>正在恢复安全会话…</span>
      </main>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthenticatedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="ai-chat" element={<AiChatPage />} />
          <Route path="403" element={<ForbiddenPage />} />
          <Route element={<RoleRoute allow={['admin']} />}>
            <Route path="merchants" element={<MerchantsPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
