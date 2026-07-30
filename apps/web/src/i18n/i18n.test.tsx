import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LanguageSwitch } from '../components/language-switch/language-switch'
import { formatCurrency, formatDateTime } from './formatters'
import i18n, { changeAppLanguage, languageStorageKey } from './i18n'

afterEach(async () => {
  await act(() => changeAppLanguage('zh-CN'))
  window.localStorage.removeItem(languageStorageKey)
})

describe('interface internationalization', () => {
  it('persists an independent interface language and updates document metadata', async () => {
    render(<LanguageSwitch />)
    expect(
      screen.getByRole('combobox', { name: '界面语言' }),
    ).toBeInTheDocument()

    await act(() => changeAppLanguage('en-US'))

    expect(
      screen.getByRole('combobox', { name: 'Interface language' }),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem(languageStorageKey)).toBe('en-US')
    expect(document.documentElement.lang).toBe('en-US')
    expect(i18n.t('optimization.esES')).toBe('Spanish')
  })

  it('formats currency and date-time with the selected interface locale', () => {
    const chineseCurrency = formatCurrency(1234.5, 'USD', 'zh-CN')
    const englishCurrency = formatCurrency(1234.5, 'USD', 'en-US')
    const chineseDate = formatDateTime('2026-07-30T08:30:00Z', 'zh-CN')
    const englishDate = formatDateTime('2026-07-30T08:30:00Z', 'en-US')

    expect(chineseCurrency).toContain('1,234.50')
    expect(englishCurrency).toBe('$1,234.50')
    expect(chineseDate).not.toBe(englishDate)
  })
})
