import { BadRequestException } from '@nestjs/common';
import { normalizePlainText, normalizeSearchText } from './text-normalizer';

describe('text normalizer security', () => {
  it('blocks formula-like SQL injection attempts', () => {
    expect(() => normalizePlainText("='1")).toThrow(BadRequestException);
  });

  it('blocks boolean SQL injection attempts in search values', () => {
    expect(() => normalizeSearchText("' OR 1=1")).toThrow(BadRequestException);
  });

  it('keeps normal text normalization working', () => {
    expect(normalizePlainText('Carlos Mejia')).toBe('CARLOS MEJIA');
  });
});
