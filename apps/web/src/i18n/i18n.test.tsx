import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { LanguageSwitch } from '../components/language-switch/language-switch'
import { ChatComposer } from '../pages/ai-chat/components/chat-composer'
import { formatCurrency, formatDateTime } from './formatters'
import i18n, { changeAppLanguage, languageStorageKey } from './i18n'
import { resources } from './resources'

function flattenTranslations(value: unknown, prefix = ''): Map<string, string> {
  const result = new Map<string, string>()
  if (typeof value === 'string') {
    result.set(prefix, value)
    return result
  }
  if (!value || typeof value !== 'object') return result
  for (const [key, child] of Object.entries(value)) {
    const childPrefix = prefix ? `${prefix}.${key}` : key
    for (const [childKey, childValue] of flattenTranslations(
      child,
      childPrefix,
    )) {
      result.set(childKey, childValue)
    }
  }
  return result
}

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

  it('keeps every Chinese source key covered by the English resource', () => {
    const chinese = flattenTranslations(resources['zh-CN'].translation)
    const english = flattenTranslations(resources['en-US'].translation)

    expect(chinese.size).toBeGreaterThan(0)
    for (const key of chinese.keys()) {
      expect(
        typeof english.get(key),
        `Missing English translation for ${key}`,
      ).toBe('string')
      expect(
        english.get(key)?.trim(),
        `Empty English translation for ${key}`,
      ).not.toBe('')
    }
  })

  it('renders newly governed AI conversation controls in English', async () => {
    await act(() => changeAppLanguage('en-US'))

    render(
      <ChatComposer
        inputValue=""
        streaming={false}
        onChange={() => undefined}
        onSend={() => Promise.resolve()}
        onStop={() => undefined}
      />,
    )

    expect(
      screen.getByPlaceholderText('Type a message and press Enter to send'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(i18n.t('users.title')).toBe('Users & permissions')
  })
})
