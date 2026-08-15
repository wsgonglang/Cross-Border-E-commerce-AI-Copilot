import { configureStore } from '@reduxjs/toolkit'

import * as authApi from '../api/auth'
import { configureApiAuthRecovery } from '../api/client'
import { authReducer, sessionExpired, sessionRecovered } from './auth.slice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
})

configureApiAuthRecovery({
  refreshAccessToken: async () => {
    const session = await authApi.refreshSession()
    store.dispatch(sessionRecovered(session))
    return session.accessToken
  },
  onSessionExpired: () => {
    store.dispatch(sessionExpired())
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
