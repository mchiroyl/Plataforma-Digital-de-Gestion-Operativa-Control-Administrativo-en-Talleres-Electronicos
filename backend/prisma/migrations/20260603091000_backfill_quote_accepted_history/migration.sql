INSERT INTO "StatusHistory" ("orderId", "previousStatus", "newStatus", "comment", "changedById", "changedAt")
SELECT
  ro.id,
  'PRESUPUESTO_ENVIADO'::"OrderStatus",
  'PRESUPUESTO_ACEPTADO'::"OrderStatus",
  CASE
    WHEN ro."approvalMethod" = 'WHATSAPP' THEN 'Presupuesto aprobado por WhatsApp'
    WHEN ro."approvalMethod" = 'PUBLIC_TRACKING' THEN 'Presupuesto aprobado por cliente'
    WHEN ro."approvalMethod" = 'IN_PERSON' THEN 'Presupuesto aprobado por personal del taller'
    ELSE 'Presupuesto aprobado'
  END,
  ro."createdById",
  COALESCE(ro."approvedAt", now()) - interval '1 millisecond'
FROM "RepairOrder" ro
WHERE ro."quoteApproved" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "StatusHistory" sh
    WHERE sh."orderId" = ro.id
      AND sh."newStatus" = 'PRESUPUESTO_ACEPTADO'
  );
