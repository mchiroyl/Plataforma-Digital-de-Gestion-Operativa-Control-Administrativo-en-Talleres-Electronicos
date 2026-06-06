UPDATE "StatusHistory" sh
SET
  "previousStatus" = 'PRESUPUESTO_ACEPTADO'::"OrderStatus",
  "comment" = 'Orden enviada a reparacion'
WHERE sh."newStatus" = 'EN_REPARACION'
  AND sh."comment" LIKE 'Presupuesto aprobado%'
  AND EXISTS (
    SELECT 1
    FROM "StatusHistory" accepted
    WHERE accepted."orderId" = sh."orderId"
      AND accepted."newStatus" = 'PRESUPUESTO_ACEPTADO'
  );
