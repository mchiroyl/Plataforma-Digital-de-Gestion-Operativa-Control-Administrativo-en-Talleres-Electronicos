import { BadRequestException } from '@nestjs/common';

const SQL_INJECTION_PATTERNS = [
  /^=\s*['"`]?.+/i,
  /(?:^|[\s'"`])(?:or|and)\s+['"`]?\w+['"`]?\s*=\s*['"`]?\w+/i,
  /\bunion\s+select\b/i,
  /;\s*(?:drop|delete|truncate|insert|update|alter|create)\b/i,
  /--|\/\*|\*\//,
  /\b(?:select|insert|update|delete|drop|alter|truncate)\b.+\b(?:from|where|table|into|set)\b/i,
];

export function assertSafeTextInput(value: string) {
  const candidate = value.trim();
  if (!candidate) return;
  if (SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(candidate))) {
    throw new BadRequestException('El campo contiene caracteres no permitidos');
  }
}

export function normalizePlainText(value: string) {
  assertSafeTextInput(value);
  return value.trim().toLocaleUpperCase('es-GT');
}

export function normalizeSearchText(value: string) {
  assertSafeTextInput(value);
  return value.trim();
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
