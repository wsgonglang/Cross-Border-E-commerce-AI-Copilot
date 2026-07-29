import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { renderRoute } from '../../test/route-test-utils'
import { RoleRoute } from './role-route'

function TestRoutes() {
  return (
    <Routes>
      <Route path="/403" element={<div>权限不足</div>} />
      <Route element={<RoleRoute allow={['admin']} />}>
        <Route path="/users" element={<div>用户与权限</div>} />
      </Route>
    </Routes>
  )
}

describe('RoleRoute', () => {
  it('renders the page when the user has an allowed role', () => {
    renderRoute(<TestRoutes />, {
      initialPath: '/users',
      roles: ['admin'],
    })

    expect(screen.getByText('用户与权限')).toBeInTheDocument()
  })

  it('redirects a user without the required role', () => {
    renderRoute(<TestRoutes />, {
      initialPath: '/users',
      roles: ['viewer'],
    })

    expect(screen.getByText('权限不足')).toBeInTheDocument()
  })
})
