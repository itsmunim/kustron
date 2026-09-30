/**
 * Small object-merge utilities used by the escape hatch (`patch`) and by
 * helm image injection.
 *
 * Semantics are deliberately simple and predictable:
 *   - plain objects merge recursively
 *   - arrays and scalars are replaced
 * This matches the "deep merge, arrays replace" contract documented in the
 * env-file spec for `patch`.
 */

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {...base};
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Set a dotted path (e.g. 'image.tag') on a nested object, creating parents. */
export function setPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!isPlainObject(cur[key])) cur[key] = {};
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

/** Read a dotted path from a nested value; undefined when missing. */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}