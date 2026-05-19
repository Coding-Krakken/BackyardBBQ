-- Add first-class correlation IDs for cross-service tracing.
ALTER TABLE "Order"
ADD COLUMN "correlationId" TEXT;

ALTER TABLE "PaymentTransaction"
ADD COLUMN "correlationId" TEXT;

ALTER TABLE "IntegrationEvent"
ADD COLUMN "correlationId" TEXT;

CREATE INDEX "Order_correlationId_idx" ON "Order"("correlationId");
CREATE INDEX "PaymentTransaction_correlationId_idx" ON "PaymentTransaction"("correlationId");
CREATE INDEX "IntegrationEvent_correlationId_idx" ON "IntegrationEvent"("correlationId");
