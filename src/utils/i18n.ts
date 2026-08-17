import { readFileSync, accessSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function findPackageRoot(startDir: string): string {
  let current = startDir
  while (current !== dirname(current)) {
    try {
      accessSync(join(current, 'package.json'))
      return current
    } catch {
      current = dirname(current)
    }
  }
  throw new Error('Could not find package.json')
}

const pkgRoot = findPackageRoot(__dirname)
const translationsPath = join(pkgRoot, 'src', 'translations', 'en.json')
const translations = JSON.parse(readFileSync(translationsPath, 'utf-8')) as Record<string, unknown>

function getValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function t(key: string, vars?: Record<string, string>): string {
  const value = getValue(translations, key)
  let text: string

  if (typeof value === 'string') {
    text = value
  } else {
    return key
  }

  if (!vars) return text

  return text.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    return vars[varName] ?? `{{${varName}}}`
  })
}
