import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { AuthenticatedUser, AuthSession } from '@cross-border/shared'

import * as authApi from '../api/auth'

type AuthStatus = 'checking' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
  accessToken: string | null
  user: AuthenticatedUser | null
  error: string | null
}

interface LoginInput {
  email: string
  password: string
}

const initialState: AuthState = {
  status: 'checking',
  accessToken: null,
  user: null,
  error: null,
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '认证请求失败'
}

export const login = createAsyncThunk<
  AuthSession,
  LoginInput,
  { rejectValue: string }
>('auth/login', async (input, { rejectWithValue }) => {
  try {
    return await authApi.login(input)
  } catch (error: unknown) {
    return rejectWithValue(errorMessage(error))
  }
})

export const restoreSession = createAsyncThunk<
  AuthSession,
  void,
  { rejectValue: string }
>('auth/restore', async (_, { rejectWithValue }) => {
  try {
    return await authApi.refreshSession()
  } catch (error: unknown) {
    return rejectWithValue(errorMessage(error))
  }
})

export const logout = createAsyncThunk('auth/logout', async () => {
  await authApi.logout()
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionRecovered: (state, action: { payload: AuthSession }) => {
      state.status = 'authenticated'
      state.accessToken = action.payload.accessToken
      state.user = action.payload.user
      state.error = null
    },
    sessionExpired: (state) => {
      state.status = 'anonymous'
      state.accessToken = null
      state.user = null
      state.error = null
    },
  },
  extraReducers: (builder) => {
    const applySession = (state: AuthState, session: AuthSession) => {
      state.status = 'authenticated'
      state.accessToken = session.accessToken
      state.user = session.user
      state.error = null
    }

    builder
      .addCase(login.pending, (state) => {
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        applySession(state, action.payload)
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'anonymous'
        state.accessToken = null
        state.user = null
        state.error = action.payload ?? '登录失败'
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        applySession(state, action.payload)
      })
      .addCase(restoreSession.rejected, (state) => {
        state.status = 'anonymous'
        state.accessToken = null
        state.user = null
        state.error = null
      })
      .addCase(logout.fulfilled, (state) => {
        state.status = 'anonymous'
        state.accessToken = null
        state.user = null
        state.error = null
      })
  },
})

export const { sessionExpired, sessionRecovered } = authSlice.actions
export const authReducer = authSlice.reducer
