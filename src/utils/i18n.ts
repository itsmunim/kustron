import translations from '../translations/en.json'

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
  const value = getValue(translations as Record<string, unknown>, key)
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
