import { screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { renderRoute } from '../../test/route-test-utils'
import { AuthenticatedRoute } from './authenticated-route'

function LoginProbe() {
  const location = useLocation()
  const state = location.state as { from?: string } | null
  return <div>登录来源：{state?.from ?? '无'}</div>
}

function TestRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginProbe />} />
      <Route element={<AuthenticatedRoute />}>
        <Route path="/orders" element={<div>订单运营</div>} />
      </Route>
    </Routes>
  )
}

describe('AuthenticatedRoute', () => {
  it('renders the protected page for an authenticated user', () => {
    renderRoute(<TestRoutes />, { initialPath: '/orders' })

    expect(screen.getByText('订单运营')).toBeInTheDocument()
  })

  it('redirects an anonymous user and preserves the requested path', () => {
    renderRoute(<TestRoutes />, {
      authenticated: false,
      initialPath: '/orders',
    })

    expect(screen.getByText('登录来源：/orders')).toBeInTheDocument()
  })
})
