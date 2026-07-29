import { Spin } from 'antd'
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthenticatedRoute } from './components/authenticated-route'
import { RoleRoute } from './components/role-route'
import { BusinessContextProvider } from './contexts/business-context'
import { AppLayout } from './layouts/app-layout'
import { AiChatPage } from './pages/ai-chat.page'
import { AiResultsPage } from './pages/ai-results.page'
import { AiSharePage } from './pages/ai-share.page'
import { BatchTasksPage } from './pages/batch-tasks.page'
import { DashboardPage } from './pages/dashboard.page'
import { ForbiddenPage } from './pages/forbidden.page'
import { LoginPage } from './pages/login.page'
import { ImportsPage } from './pages/imports.page'
import { MerchantsPage } from './pages/merchants.page'
import { OrdersPage } from './pages/orders.page'
import { ProductsPage } from './pages/products.page'
import { RuleDocumentsPage } from './pages/rule-documents.page'
import { StoresPage } from './pages/stores.page'
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
        <Route
          element={
            <BusinessContextProvider>
              <AppLayout />
            </BusinessContextProvider>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="403" element={<ForbiddenPage />} />
          <Route path="ai-shares/:shareId" element={<AiSharePage />} />
          <Route element={<RoleRoute allow={['admin', 'operator']} />}>
            <Route path="ai-chat" element={<AiChatPage />} />
            <Route path="ai-results" element={<AiResultsPage />} />
            <Route path="batch-tasks" element={<BatchTasksPage />} />
            <Route path="imports" element={<ImportsPage />} />
            <Route path="stores" element={<StoresPage />} />
          </Route>
          <Route element={<RoleRoute allow={['admin']} />}>
            <Route path="merchants" element={<MerchantsPage />} />
            <Route path="rule-documents" element={<RuleDocumentsPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
