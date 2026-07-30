import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { resources } from './resources'

export const languageStorageKey = 'copilot.uiLanguage'
export type AppLanguage = 'zh-CN' | 'en-US'

function readInitialLanguage(): AppLanguage {
  const saved = window.localStorage.getItem(languageStorageKey)
  return saved === 'en-US' ? 'en-US' : 'zh-CN'
}

void i18n.use(initReactI18next).init({
  resources,
  lng: readInitialLanguage(),
  fallbackLng: 'zh-CN',
  supportedLngs: ['zh-CN', 'en-US'],
  interpolation: { escapeValue: false },
  returnNull: false,
})

export async function changeAppLanguage(language: AppLanguage) {
  window.localStorage.setItem(languageStorageKey, language)
  await i18n.changeLanguage(language)
  document.documentElement.lang = language
}

document.documentElement.lang = readInitialLanguage()

export default i18n
