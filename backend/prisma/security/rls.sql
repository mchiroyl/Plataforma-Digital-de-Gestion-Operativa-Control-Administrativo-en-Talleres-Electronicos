DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = __APP_USER_NAME__) THEN
    EXECUTE 'CREATE ROLE ' || quote_ident(__APP_USER_NAME__) || ' LOGIN PASSWORD ' || quote_literal(__APP_PASSWORD_TEXT__);
  ELSE
    EXECUTE 'ALTER ROLE ' || quote_ident(__APP_USER_NAME__) || ' WITH LOGIN PASSWORD ' || quote_literal(__APP_PASSWORD_TEXT__);
  END IF;
END $$;

GRANT CONNECT ON DATABASE talleres_electronicos TO __APP_USER__;
GRANT USAGE ON SCHEMA public TO __APP_USER__;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO __APP_USER__;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO __APP_USER__;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO __APP_USER__;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO __APP_USER__;

CREATE OR REPLACE FUNCTION app_current_role() RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT COALESCE(NULLIF(current_setting('app.user_role', true), ''), 'ANON') $$;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS integer
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::integer $$;

CREATE OR REPLACE FUNCTION app_current_tracking_token() RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.tracking_token', true), '') $$;

CREATE OR REPLACE FUNCTION app_current_public_order_id() RETURNS integer
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.public_order_id', true), '')::integer $$;

CREATE OR REPLACE FUNCTION app_current_ip_address() RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.ip_address', true), '') $$;

CREATE OR REPLACE FUNCTION app_current_user_agent() RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.user_agent', true), '') $$;

CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT app_current_role() IN ('ADMIN', 'RECEPCIONISTA', 'TECNICO') $$;

CREATE OR REPLACE FUNCTION app_can_access_public_order(order_id integer, tracking_token text) RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT
    tracking_token = app_current_tracking_token()
    OR order_id = app_current_public_order_id()
$$;

CREATE OR REPLACE FUNCTION app_audit_row_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_payload jsonb;
  new_payload jsonb;
  affected_record_id text;
  fields text[] := ARRAY[]::text[];
BEGIN
  IF TG_TABLE_NAME = 'AuditLog' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  old_payload := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  new_payload := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  affected_record_id := COALESCE(new_payload ->> 'id', old_payload ->> 'id');

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
    INTO fields
    FROM (
      SELECT key
      FROM jsonb_object_keys(old_payload || new_payload) AS key
      WHERE (old_payload -> key) IS DISTINCT FROM (new_payload -> key)
    ) changed;
  ELSE
    SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::text[])
    INTO fields
    FROM jsonb_object_keys(COALESCE(new_payload, old_payload)) AS key;
  END IF;

  INSERT INTO "AuditLog" (
    "tableName",
    "recordId",
    action,
    "changedById",
    "changedByRole",
    "previousValues",
    "newValues",
    "changedFields",
    "ipAddress",
    "userAgent"
  )
  VALUES (
    TG_TABLE_NAME,
    affected_record_id,
    TG_OP::"AuditAction",
    app_current_user_id(),
    app_current_role(),
    old_payload,
    new_payload,
    fields,
    app_current_ip_address(),
    app_current_user_agent()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_attach_audit_trigger(target_table regclass) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  trigger_name text;
BEGIN
  trigger_name := 'audit_' || replace(target_table::text, '"', '') || '_row_change';
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trigger_name, target_table);
  EXECUTE format(
    'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION app_audit_row_change()',
    trigger_name,
    target_table
  );
END;
$$;

SELECT app_attach_audit_trigger('"Client"');
SELECT app_attach_audit_trigger('"Equipment"');
SELECT app_attach_audit_trigger('"RepairOrder"');
SELECT app_attach_audit_trigger('"QuoteDetail"');
SELECT app_attach_audit_trigger('"SparePart"');
SELECT app_attach_audit_trigger('"InventoryMovement"');
SELECT app_attach_audit_trigger('"InventorySale"');
SELECT app_attach_audit_trigger('"InventorySaleItem"');
SELECT app_attach_audit_trigger('"Payment"');
SELECT app_attach_audit_trigger('"Expense"');
SELECT app_attach_audit_trigger('"RepairOrderEvidence"');
SELECT app_attach_audit_trigger('"ShopSettings"');

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_select_policy ON "Role";
CREATE POLICY role_select_policy ON "Role"
  FOR SELECT
  USING (app_is_staff() OR app_current_role() = 'ANON');

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_staff_policy ON "User";
CREATE POLICY user_staff_policy ON "User"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());
DROP POLICY IF EXISTS user_login_policy ON "User";
CREATE POLICY user_login_policy ON "User"
  FOR SELECT
  USING (app_current_role() = 'ANON' AND "isActive" = true);

ALTER TABLE "ShopSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShopSettings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_settings_policy ON "ShopSettings";
CREATE POLICY shop_settings_policy ON "ShopSettings"
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS shop_settings_staff_policy ON "ShopSettings";
CREATE POLICY shop_settings_staff_policy ON "ShopSettings"
  FOR UPDATE
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "EquipmentType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EquipmentType" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS equipment_type_policy ON "EquipmentType";
CREATE POLICY equipment_type_policy ON "EquipmentType"
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS equipment_type_staff_policy ON "EquipmentType";
CREATE POLICY equipment_type_staff_policy ON "EquipmentType"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "FaultCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FaultCategory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fault_category_policy ON "FaultCategory";
CREATE POLICY fault_category_policy ON "FaultCategory"
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS fault_category_staff_policy ON "FaultCategory";
CREATE POLICY fault_category_staff_policy ON "FaultCategory"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "FaultType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FaultType" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fault_type_policy ON "FaultType";
CREATE POLICY fault_type_policy ON "FaultType"
  FOR SELECT
  USING (true);
DROP POLICY IF EXISTS fault_type_staff_policy ON "FaultType";
CREATE POLICY fault_type_staff_policy ON "FaultType"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_staff_policy ON "Client";
CREATE POLICY client_staff_policy ON "Client"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());
DROP POLICY IF EXISTS client_public_policy ON "Client";
CREATE POLICY client_public_policy ON "Client"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "RepairOrder" ro
      WHERE ro."clientId" = "Client".id
        AND app_can_access_public_order(ro.id, ro."trackingToken")
    )
  );

ALTER TABLE "Equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Equipment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS equipment_staff_policy ON "Equipment";
CREATE POLICY equipment_staff_policy ON "Equipment"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());
DROP POLICY IF EXISTS equipment_public_policy ON "Equipment";
CREATE POLICY equipment_public_policy ON "Equipment"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "RepairOrder" ro
      WHERE ro."equipmentId" = "Equipment".id
        AND app_can_access_public_order(ro.id, ro."trackingToken")
    )
  );

ALTER TABLE "Technician" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Technician" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS technician_staff_policy ON "Technician";
CREATE POLICY technician_staff_policy ON "Technician"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "RepairOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RepairOrder" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS repair_order_staff_policy ON "RepairOrder";
CREATE POLICY repair_order_staff_policy ON "RepairOrder"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());
DROP POLICY IF EXISTS repair_order_public_select_policy ON "RepairOrder";
CREATE POLICY repair_order_public_select_policy ON "RepairOrder"
  FOR SELECT
  USING (app_can_access_public_order(id, "trackingToken"));
DROP POLICY IF EXISTS repair_order_public_update_policy ON "RepairOrder";
CREATE POLICY repair_order_public_update_policy ON "RepairOrder"
  FOR UPDATE
  USING (app_can_access_public_order(id, "trackingToken"))
  WITH CHECK (app_can_access_public_order(id, "trackingToken"));

ALTER TABLE "OrderFaultType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderFaultType" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_fault_staff_policy ON "OrderFaultType";
CREATE POLICY order_fault_staff_policy ON "OrderFaultType"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());
DROP POLICY IF EXISTS order_fault_public_policy ON "OrderFaultType";
CREATE POLICY order_fault_public_policy ON "OrderFaultType"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "RepairOrder" ro
      WHERE ro.id = "OrderFaultType"."orderId"
        AND app_can_access_public_order(ro.id, ro."trackingToken")
    )
  );

ALTER TABLE "StatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StatusHistory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS status_history_staff_policy ON "StatusHistory";
CREATE POLICY status_history_staff_policy ON "StatusHistory"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());
DROP POLICY IF EXISTS status_history_public_policy ON "StatusHistory";
CREATE POLICY status_history_public_policy ON "StatusHistory"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "RepairOrder" ro
      WHERE ro.id = "StatusHistory"."orderId"
        AND app_can_access_public_order(ro.id, ro."trackingToken")
    )
  );
DROP POLICY IF EXISTS status_history_public_insert_policy ON "StatusHistory";
CREATE POLICY status_history_public_insert_policy ON "StatusHistory"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "RepairOrder" ro
      WHERE ro.id = "StatusHistory"."orderId"
        AND app_can_access_public_order(ro.id, ro."trackingToken")
    )
  );

ALTER TABLE "QuoteDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuoteDetail" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quote_detail_staff_policy ON "QuoteDetail";
CREATE POLICY quote_detail_staff_policy ON "QuoteDetail"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());
DROP POLICY IF EXISTS quote_detail_public_policy ON "QuoteDetail";
CREATE POLICY quote_detail_public_policy ON "QuoteDetail"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "RepairOrder" ro
      WHERE ro.id = "QuoteDetail"."orderId"
        AND app_can_access_public_order(ro.id, ro."trackingToken")
    )
  );

ALTER TABLE "SparePart" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SparePart" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS spare_part_staff_policy ON "SparePart";
CREATE POLICY spare_part_staff_policy ON "SparePart"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());
DROP POLICY IF EXISTS spare_part_public_policy ON "SparePart";
CREATE POLICY spare_part_public_policy ON "SparePart"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "QuoteDetail" q
      JOIN "RepairOrder" ro ON ro.id = q."orderId"
      WHERE q."sparePartId" = "SparePart".id
        AND app_can_access_public_order(ro.id, ro."trackingToken")
    )
  );
DROP POLICY IF EXISTS spare_part_public_quote_update_policy ON "SparePart";
CREATE POLICY spare_part_public_quote_update_policy ON "SparePart"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM "QuoteDetail" q
      JOIN "RepairOrder" ro ON ro.id = q."orderId"
      WHERE q."sparePartId" = "SparePart".id
        AND app_can_access_public_order(ro.id, ro."trackingToken")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "QuoteDetail" q
      JOIN "RepairOrder" ro ON ro.id = q."orderId"
      WHERE q."sparePartId" = "SparePart".id
        AND app_can_access_public_order(ro.id, ro."trackingToken")
    )
  );

ALTER TABLE "InventoryMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryMovement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_movement_staff_policy ON "InventoryMovement";
CREATE POLICY inventory_movement_staff_policy ON "InventoryMovement"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());
DROP POLICY IF EXISTS inventory_movement_public_quote_insert_policy ON "InventoryMovement";
CREATE POLICY inventory_movement_public_quote_insert_policy ON "InventoryMovement"
  FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS inventory_movement_public_quote_select_policy ON "InventoryMovement";
CREATE POLICY inventory_movement_public_quote_select_policy ON "InventoryMovement"
  FOR SELECT
  USING (
    "movementType" = 'SALIDA_ORDEN'
    AND "referenceType" = 'ORDER_QUOTE'
  );

ALTER TABLE "InventorySale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventorySale" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_sale_staff_policy ON "InventorySale";
CREATE POLICY inventory_sale_staff_policy ON "InventorySale"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "InventorySaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventorySaleItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_sale_item_staff_policy ON "InventorySaleItem";
CREATE POLICY inventory_sale_item_staff_policy ON "InventorySaleItem"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_staff_policy ON "Payment";
CREATE POLICY payment_staff_policy ON "Payment"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expense_staff_policy ON "Expense";
CREATE POLICY expense_staff_policy ON "Expense"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "RepairOrderEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RepairOrderEvidence" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS repair_order_evidence_staff_policy ON "RepairOrderEvidence";
CREATE POLICY repair_order_evidence_staff_policy ON "RepairOrderEvidence"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "WhatsappNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsappNotification" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_notification_staff_policy ON "WhatsappNotification";
CREATE POLICY whatsapp_notification_staff_policy ON "WhatsappNotification"
  FOR ALL
  USING (app_is_staff())
  WITH CHECK (app_is_staff());

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_admin_select_policy ON "AuditLog";
CREATE POLICY audit_log_admin_select_policy ON "AuditLog"
  FOR SELECT
  USING (app_current_role() = 'ADMIN');
DROP POLICY IF EXISTS audit_log_system_insert_policy ON "AuditLog";
CREATE POLICY audit_log_system_insert_policy ON "AuditLog"
  FOR INSERT
  WITH CHECK (true);
