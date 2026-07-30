import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { changeAppLanguage } from '../../i18n/i18n'
import { renderRoute } from '../../test/route-test-utils'
import { LoginPage } from './login.page'

describe('LoginPage', () => {
  beforeEach(async () => {
    await act(() => changeAppLanguage('en-US'))
  })

  afterEach(async () => {
    await act(() => changeAppLanguage('zh-CN'))
  })

  it('keeps the interface language control visible and fills demo roles', async () => {
    const user = userEvent.setup()
    renderRoute(<LoginPage />, {
      authenticated: false,
      initialPath: '/login',
    })

    expect(
      screen.getByRole('combobox', { name: 'Interface language' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Administrator' }))

    expect(screen.getByLabelText('Email')).toHaveValue('admin@copilot.local')
    expect(screen.getByLabelText('Password')).toHaveValue('Demo123!')
  })
})
