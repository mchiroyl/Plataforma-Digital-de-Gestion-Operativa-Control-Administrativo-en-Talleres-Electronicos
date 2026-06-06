import { buildQuoteDecisionHistory } from './quote-decision-flow';

describe('buildQuoteDecisionHistory', () => {
  it('adds PRESUPUESTO_ACEPTADO before EN_REPARACION when the customer accepts', () => {
    expect(
      buildQuoteDecisionHistory({
        previousStatus: 'PRESUPUESTO_ENVIADO',
        approved: true,
        sourceLabel: 'cliente',
      }),
    ).toEqual([
      {
        previousStatus: 'PRESUPUESTO_ENVIADO',
        newStatus: 'PRESUPUESTO_ACEPTADO',
        comment: 'Presupuesto aprobado por cliente',
      },
      {
        previousStatus: 'PRESUPUESTO_ACEPTADO',
        newStatus: 'EN_REPARACION',
        comment: 'Orden enviada a reparacion',
      },
    ]);
  });

  it('keeps rejection as PRESUPUESTO_RECHAZADO', () => {
    expect(
      buildQuoteDecisionHistory({
        previousStatus: 'PRESUPUESTO_ENVIADO',
        approved: false,
        sourceLabel: 'cliente',
      }),
    ).toEqual([
      {
        previousStatus: 'PRESUPUESTO_ENVIADO',
        newStatus: 'PRESUPUESTO_RECHAZADO',
        comment: 'Presupuesto rechazado por cliente',
      },
    ]);
  });
});
