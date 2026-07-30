import type { AppLanguage } from './i18n'

export function formatCurrency(
  value: string | number,
  currency: string,
  language: AppLanguage,
): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value))
}

export function formatDate(value: string | Date, language: AppLanguage) {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
  }).format(new Date(value))
}

export function formatDateTime(value: string | Date, language: AppLanguage) {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatMonthDay(value: string | Date, language: AppLanguage) {
  return new Intl.DateTimeFormat(language, {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}
