import translations from '../translations/en.json' with {type: 'json'};

function getValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function isStrictI18n(): boolean {
  return process.env.NODE_ENV === 'test';
}

export function t(key: string, vars?: Record<string, string>): string {
  const value = getValue(translations as Record<string, unknown>, key);
  let text: string;

  if (typeof value === 'string') {
    text = value;
  } else {
    // Fail loudly in tests so missing keys can't silently prove nothing;
    // stay graceful (echo the key) for production/CLI users.
    if (isStrictI18n()) {
      throw new Error(`Missing translation key: ${key}`);
    }
    return key;
  }

  if (!vars) return text;

  return text.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    return vars[varName] ?? `{{${varName}}}`;
  });
}
