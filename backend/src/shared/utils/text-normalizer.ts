export function normalizePlainText(value: string) {
  return value.trim().toLocaleUpperCase('es-GT');
}

export function normalizeInput<T>(value: T): T {
  if (typeof value === 'string') return normalizePlainText(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeInput(item)) as T;
  if (value instanceof Date || value === null || value === undefined) return value;
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeInput(item)])) as T;
  }
  return value;
}
