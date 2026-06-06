CREATE TYPE "EvidenceType" AS ENUM ('RECEPCION', 'DIAGNOSTICO', 'REPARACION', 'ENTREGA');

CREATE TABLE "RepairOrderEvidence" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairOrderEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "responsible" TEXT NOT NULL,
    "notes" TEXT,
    "registeredById" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RepairOrderEvidence_orderId_isActive_idx" ON "RepairOrderEvidence"("orderId", "isActive");
CREATE INDEX "Expense_spentAt_idx" ON "Expense"("spentAt");
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

ALTER TABLE "RepairOrderEvidence" ADD CONSTRAINT "RepairOrderEvidence_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RepairOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepairOrderEvidence" ADD CONSTRAINT "RepairOrderEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
