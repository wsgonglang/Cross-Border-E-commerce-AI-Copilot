import type { UserSummary } from '@cross-border/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createUser, getUsers, updateUser } from '../../api/auth'
import { UsersPage } from './users.page'

const currentUser: UserSummary = {
  id: 'admin-1',
  email: 'admin@copilot.local',
  name: '平台管理员',
  roles: ['admin'],
  merchantIds: ['merchant-1'],
  status: 'ACTIVE',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const operator: UserSummary = {
  ...currentUser,
  id: 'operator-1',
  email: 'operator@copilot.local',
  name: '商品运营',
  roles: ['operator'],
}

vi.mock('../../api/auth', () => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getUsers: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('../../store/hooks', () => ({
  useAppSelector: vi.fn((selector: (state: unknown) => unknown) =>
    selector({ auth: { accessToken: 'token', user: currentUser } }),
  ),
}))

vi.mock('../../contexts/business-context', () => ({
  useBusinessContext: () => ({
    merchants: [
      {
        id: 'merchant-1',
        code: 'DEMO-US',
        name: 'Demo 北美店铺',
        status: 'ACTIVE',
        defaultCurrency: 'USD',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
  }),
}))

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUsers).mockResolvedValue([currentUser, operator])
    vi.mocked(createUser).mockResolvedValue(operator)
    vi.mocked(updateUser).mockResolvedValue({
      ...operator,
      status: 'DISABLED',
    })
  })

  it('shows CRUD actions while protecting the current account', async () => {
    render(<UsersPage />)

    expect(await screen.findByText('平台管理员')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新增用户' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: '编辑' })).toHaveLength(2)

    const disableButtons = screen.getAllByRole('button', { name: '停用' })
    const deleteButtons = screen.getAllByRole('button', { name: '删除' })
    expect(disableButtons[0]).toBeDisabled()
    expect(deleteButtons[0]).toBeDisabled()
    expect(disableButtons[1]).toBeEnabled()
    expect(deleteButtons[1]).toBeEnabled()
  })

  it('creates a user with an initial role and merchant scope', async () => {
    render(<UsersPage />)
    await screen.findByText('商品运营')
    fireEvent.click(screen.getByRole('button', { name: '新增用户' }))

    fireEvent.change(screen.getByLabelText('姓名'), {
      target: { value: '新运营成员' },
    })
    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'new@copilot.local' },
    })
    fireEvent.change(screen.getByLabelText('初始密码'), {
      target: { value: 'Password123!' },
    })
    const saveButton = document.querySelector<HTMLButtonElement>(
      '.ant-modal-footer .ant-btn-primary',
    )
    expect(saveButton).not.toBeNull()
    fireEvent.click(saveButton!)

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith('token', {
        email: 'new@copilot.local',
        name: '新运营成员',
        password: 'Password123!',
        roles: ['operator'],
        merchantIds: ['merchant-1'],
      }),
    )
  })

  it('can disable another user and reload the list', async () => {
    render(<UsersPage />)
    await screen.findByText('商品运营')
    const action = screen
      .getAllByRole('button', { name: '停用' })
      .find((button) => !button.hasAttribute('disabled'))
    expect(action).toBeDefined()
    fireEvent.click(action!)

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith('token', 'operator-1', {
        status: 'DISABLED',
      }),
    )
    expect(getUsers).toHaveBeenCalledTimes(2)
  })
})
