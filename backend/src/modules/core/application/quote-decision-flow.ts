type QuoteDecisionHistoryInput = {
  previousStatus: string;
  approved: boolean;
  sourceLabel: string;
  customerName?: string;
  comment?: string;
};

type QuoteDecisionHistoryItem = {
  previousStatus: string;
  newStatus: string;
  comment: string;
};

function sourceSuffix(input: QuoteDecisionHistoryInput) {
  return `${input.sourceLabel}${input.customerName ? `: ${input.customerName}` : ''}${input.comment ? `. ${input.comment}` : ''}`;
}

export function buildQuoteDecisionHistory(input: QuoteDecisionHistoryInput): QuoteDecisionHistoryItem[] {
  if (!input.approved) {
    return [
      {
        previousStatus: input.previousStatus,
        newStatus: 'PRESUPUESTO_RECHAZADO',
        comment: `Presupuesto rechazado por ${sourceSuffix(input)}`,
      },
    ];
  }

  return [
    {
      previousStatus: input.previousStatus,
      newStatus: 'PRESUPUESTO_ACEPTADO',
      comment: `Presupuesto aprobado por ${sourceSuffix(input)}`,
    },
    {
      previousStatus: 'PRESUPUESTO_ACEPTADO',
      newStatus: 'EN_REPARACION',
      comment: 'Orden enviada a reparacion',
    },
  ];
}

export function quoteDecisionFinalStatus(approved: boolean) {
  return approved ? 'EN_REPARACION' : 'PRESUPUESTO_RECHAZADO';
}
