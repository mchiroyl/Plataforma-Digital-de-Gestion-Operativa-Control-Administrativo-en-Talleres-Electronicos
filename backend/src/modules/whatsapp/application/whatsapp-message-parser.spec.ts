import { parseWhatsappQuoteDecision } from './whatsapp.service';

describe('parseWhatsappQuoteDecision', () => {
  it('detects an acceptance with an explicit order code', () => {
    expect(parseWhatsappQuoteDecision('SI ACEPTO ORD-2026-00001')).toEqual({
      approved: true,
      orderCode: 'ORD-2026-00001',
    });
  });

  it('detects a rejection with an explicit order code', () => {
    expect(parseWhatsappQuoteDecision('No acepto ORD-2026-00001')).toEqual({
      approved: false,
      orderCode: 'ORD-2026-00001',
    });
  });

  it('detects acceptance intent without an order code', () => {
    expect(parseWhatsappQuoteDecision('SI')).toEqual({
      approved: true,
    });
  });

  it('detects rejection intent without an order code', () => {
    expect(parseWhatsappQuoteDecision('NO')).toEqual({
      approved: false,
    });
  });

  it('detects an acceptance with a short order code', () => {
    expect(parseWhatsappQuoteDecision('SI 00018')).toEqual({
      approved: true,
      orderSuffix: '00018',
    });
  });

  it('detects a rejection with a short order code', () => {
    expect(parseWhatsappQuoteDecision('NO 00018')).toEqual({
      approved: false,
      orderSuffix: '00018',
    });
  });

  it('keeps accepting explicit phrases', () => {
    expect(parseWhatsappQuoteDecision('acepto')).toEqual({
      approved: true,
    });
    expect(parseWhatsappQuoteDecision('rechazo')).toEqual({
      approved: false,
    });
  });
});
