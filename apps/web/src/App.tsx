import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthenticatedRoute } from './components/authenticated-route/authenticated-route'
import { RoleRoute } from './components/role-route/role-route'
import { RouteLoading } from './components/route-loading/route-loading'
import { BusinessContextProvider } from './contexts/business-context'
import { restoreSession } from './store/auth.slice'
import { useAppDispatch, useAppSelector } from './store/hooks'

const AppLayout = lazy(() =>
  import('./layouts/app-layout/app-layout').then((module) => ({
    default: module.AppLayout,
  })),
)
const AiChatPage = lazy(() =>
  import('./pages/ai-chat/ai-chat.page').then((module) => ({
    default: module.AiChatPage,
  })),
)
const AiResultsPage = lazy(() =>
  import('./pages/ai-results/ai-results.page').then((module) => ({
    default: module.AiResultsPage,
  })),
)
const AiQualityPage = lazy(() =>
  import('./pages/ai-quality/ai-quality.page').then((module) => ({
    default: module.AiQualityPage,
  })),
)
const AiSharePage = lazy(() =>
  import('./pages/ai-share/ai-share.page').then((module) => ({
    default: module.AiSharePage,
  })),
)
const BatchTasksPage = lazy(() =>
  import('./pages/batch-tasks/batch-tasks.page').then((module) => ({
    default: module.BatchTasksPage,
  })),
)
const DashboardPage = lazy(() =>
  import('./pages/dashboard/dashboard.page').then((module) => ({
    default: module.DashboardPage,
  })),
)
const ForbiddenPage = lazy(() =>
  import('./pages/forbidden/forbidden.page').then((module) => ({
    default: module.ForbiddenPage,
  })),
)
const ImportsPage = lazy(() =>
  import('./pages/imports/imports.page').then((module) => ({
    default: module.ImportsPage,
  })),
)
const LoginPage = lazy(() =>
  import('./pages/login/login.page').then((module) => ({
    default: module.LoginPage,
  })),
)
const MerchantsPage = lazy(() =>
  import('./pages/merchants/merchants.page').then((module) => ({
    default: module.MerchantsPage,
  })),
)
const OrdersPage = lazy(() =>
  import('./pages/orders/orders.page').then((module) => ({
    default: module.OrdersPage,
  })),
)
const ProductsPage = lazy(() =>
  import('./pages/products/products.page').then((module) => ({
    default: module.ProductsPage,
  })),
)
const RuleDocumentsPage = lazy(() =>
  import('./pages/rule-documents/rule-documents.page').then((module) => ({
    default: module.RuleDocumentsPage,
  })),
)
const StoresPage = lazy(() =>
  import('./pages/stores/stores.page').then((module) => ({
    default: module.StoresPage,
  })),
)
const UsersPage = lazy(() =>
  import('./pages/users/users.page').then((module) => ({
    default: module.UsersPage,
  })),
)

function routeElement(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>
}

export function App() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const status = useAppSelector((state) => state.auth.status)

  useEffect(() => {
    void dispatch(restoreSession())
  }, [dispatch])

  if (status === 'checking') {
    return (
      <main className="session-loading">
        <div className="brand-mark">CB</div>
        <span className="route-loading-spinner" aria-hidden="true" />
        <span>{t('app.restoring')}</span>
      </main>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={routeElement(<LoginPage />)} />
      <Route element={<AuthenticatedRoute />}>
        <Route
          element={
            <BusinessContextProvider>
              {routeElement(<AppLayout />)}
            </BusinessContextProvider>
          }
        >
          <Route index element={routeElement(<DashboardPage />)} />
          <Route path="orders" element={routeElement(<OrdersPage />)} />
          <Route path="products" element={routeElement(<ProductsPage />)} />
          <Route path="403" element={routeElement(<ForbiddenPage />)} />
          <Route
            path="ai-shares/:shareId"
            element={routeElement(<AiSharePage />)}
          />
          <Route element={<RoleRoute allow={['admin', 'operator']} />}>
            <Route path="ai-chat" element={routeElement(<AiChatPage />)} />
            <Route
              path="ai-results"
              element={routeElement(<AiResultsPage />)}
            />
            <Route
              path="ai-quality"
              element={routeElement(<AiQualityPage />)}
            />
            <Route
              path="batch-tasks"
              element={routeElement(<BatchTasksPage />)}
            />
            <Route path="imports" element={routeElement(<ImportsPage />)} />
            <Route path="stores" element={routeElement(<StoresPage />)} />
          </Route>
          <Route element={<RoleRoute allow={['admin']} />}>
            <Route path="merchants" element={routeElement(<MerchantsPage />)} />
            <Route
              path="rule-documents"
              element={routeElement(<RuleDocumentsPage />)}
            />
            <Route path="users" element={routeElement(<UsersPage />)} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
