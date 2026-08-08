import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const workspaceRoot = resolve(import.meta.dirname, '..')
const governedPaths = [
  'apps/web/src/layouts/app-layout',
  'apps/web/src/components/language-switch',
  'apps/web/src/components/product-optimization-drawer',
  'apps/web/src/pages/ai-chat',
  'apps/web/src/pages/ai-results',
  'apps/web/src/pages/ai-quality',
  'apps/web/src/pages/dashboard',
  'apps/web/src/pages/login',
  'apps/web/src/pages/orders',
  'apps/web/src/pages/products',
  'apps/web/src/pages/users/users.page.tsx',
  'apps/web/src/pages/forbidden/forbidden.page.tsx',
  'apps/web/src/components/route-loading/route-loading.tsx',
]

function collectSourceFiles(path) {
  const absolutePath = resolve(workspaceRoot, path)
  if (extname(absolutePath)) return [absolutePath]
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = join(absolutePath, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(childPath)
    if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) return []
    return [childPath]
  })
}

const violations = governedPaths
  .flatMap(collectSourceFiles)
  .filter((file) => /[\u3400-\u9fff]/u.test(readFileSync(file, 'utf8')))
  .map((file) => relative(workspaceRoot, file))

if (violations.length) {
  console.error(
    `Hard-coded Chinese UI copy found in governed files:\n${violations
      .map((file) => `- ${file}`)
      .join('\n')}`,
  )
  process.exitCode = 1
} else {
  console.log('Internationalization source check passed.')
}
