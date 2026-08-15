import { expect, type Page, test } from '@playwright/test'

async function loginAs(page: Page, role: '运营人员' | '只读访客') {
  await page.goto('/login')
  await page.getByRole('button', { name: role }).click()
  await page.getByRole('button', { name: '安全登录' }).click()
  await expect(page).toHaveURL(/\/$/)
}

test('operator can enter the human-reviewed product optimization flow', async ({
  page,
}) => {
  await loginAs(page, '运营人员')
  await page.getByRole('link', { name: '商品与 SKU' }).click()
  await expect(page.getByRole('heading', { name: '商品与 SKU' })).toBeVisible()

  const productCode = `P-E2E-${Date.now()}`
  await page.getByRole('button', { name: '新建商品' }).click()
  const productDialog = page.getByRole('dialog', { name: '新建商品' })
  await productDialog.getByLabel('商品编码').fill(productCode)
  await productDialog.getByLabel('标题').fill('Playwright interview product')
  await productDialog.getByRole('button', { name: /确 定|OK/ }).click()

  const productRow = page.getByRole('row').filter({ hasText: productCode })
  await productRow.getByRole('button', { name: 'AI 优化' }).click()
  await expect(page.getByText(`AI 商品优化 · ${productCode}`)).toBeVisible()

  const generate = page.getByRole('button', {
    name: /生成草稿|重新生成/,
  })
  await expect(generate).toBeVisible()
  if (await page.getByText('选择目标语言并生成第一份 AI 草稿').isVisible()) {
    await generate.click()
  }

  await expect(page.getByText('当前商品')).toBeVisible()
  await expect(page.getByText('AI 草稿')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '人工确认并写回' }),
  ).toBeVisible()
})

test('viewer can inspect products but has no product write controls', async ({
  page,
}) => {
  await loginAs(page, '只读访客')
  await page.getByRole('link', { name: '商品与 SKU' }).click()
  await expect(page.getByRole('heading', { name: '商品与 SKU' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增商品' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'AI 优化' })).toHaveCount(0)
})

test('interface language changes independently from business data language', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('界面语言').click()
  await page.getByText('English', { exact: true }).click()

  await expect(
    page.getByRole('heading', { name: 'Sign in to AI Copilot' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Secure sign in' }),
  ).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
})
