import type { AuthenticatedUser } from '@cross-border/shared'
import { configureStore } from '@reduxjs/toolkit'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'

import { authReducer } from '../store/auth.slice'

interface RenderRouteOptions {
  authenticated?: boolean
  initialPath: string
  roles?: AuthenticatedUser['roles']
}

export function renderRoute(
  children: ReactNode,
  {
    authenticated = true,
    initialPath,
    roles = ['operator'],
  }: RenderRouteOptions,
) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        status: authenticated
          ? ('authenticated' as const)
          : ('anonymous' as const),
        accessToken: authenticated ? 'test-access-token' : null,
        user: authenticated
          ? {
              id: 'user-test',
              email: 'operator@example.com',
              name: '测试运营',
              roles,
              merchantIds: ['merchant-test'],
            }
          : null,
        error: null,
      },
    },
  })

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
    </Provider>,
  )
}
