-- ============================================================================
-- SPECIALTECH AI ERP — ПОЛНАЯ СХЕМА БАЗЫ ДАННЫХ POSTGRESQL (PostgreSQL 15+ / 17+)
-- Версия: 2.1.0 (Доменно-изолированная мультисхемная архитектура: 12 схем, 56 таблиц)
-- Контуры: А) Обособленный операционный поток участка (Водитель + Карта <-> Участок <-> Техника <-> Заказчик/Заявка);
--          Б) Общие реестры (Договоры/юротдел, RAG, 1С) и сводно-аналитические выборки руководителя.
-- Иерархия срезов: Участок (branch_id) -> День (period_day) -> Месяц (period_month) -> Год (period_year)
-- Совместимость: Выполняется "из коробки" на чистом PostgreSQL 17 (pgvector подключается опционально)
-- ============================================================================

-- 1. РАСШИРЕНИЯ POSTGRESQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- 2. ДОМЕННЫЕ СХЕМЫ БАЗЫ ДАННЫХ (12 РАЗДЕЛОВ)
CREATE SCHEMA IF NOT EXISTS branch;
CREATE SCHEMA IF NOT EXISTS customer;
CREATE SCHEMA IF NOT EXISTS fleet;
CREATE SCHEMA IF NOT EXISTS maintenance;
CREATE SCHEMA IF NOT EXISTS driver;
CREATE SCHEMA IF NOT EXISTS subrent;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS erp;
CREATE SCHEMA IF NOT EXISTS forms;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS rag;
CREATE SCHEMA IF NOT EXISTS meta;

-- 3. ПЕРЕЧИСЛЕНИЯ (ENUM ТИПЫ В PUBLIC ДЛЯ СКВОЗНОГО ИСПОЛЬЗОВАНИЯ)
DO $$ BEGIN
    CREATE TYPE system_role_enum AS ENUM (
        'admin', 'top_manager', 'fleet_manager', 'lawyer', 'accountant', 'driver'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE page_access_level_enum AS ENUM ('edit', 'view', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE equipment_type_enum AS ENUM (
        'excavator', 'crane', 'dump_truck', 'loader', 'bulldozer', 'cherry_picker'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE equipment_status_enum AS ENUM ('rented', 'available', 'maintenance', 'reserve');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE equipment_ownership_enum AS ENUM ('own', 'leasing', 'subrent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE crm_stage_enum AS ENUM ('lead', 'calculation', 'contract', 'active', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_status_enum AS ENUM ('active', 'scheduled', 'completed', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE shift_status_enum AS ENUM ('pending', 'approved', 'anomaly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_category_enum AS ENUM (
        'fuel_own_tank', 'fuel_for_equipment', 'parts', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE client_type_enum AS ENUM ('legal_entity', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE accounting_subject_enum AS ENUM ('ip_specialtechnica', 'ooo_specialtech');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE overhead_category_enum AS ENUM (
        'office_itr_salary', 'aho', 'leasing', 'taxes', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE closing_doc_kind_enum AS ENUM ('act_services', 'ks2', 'ks3', 'invoice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status_enum AS ENUM (
        'not_issued', 'issued', 'partially_paid', 'paid', 'overdue'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE notification_category_enum AS ENUM (
        'act_ks2', 'invoice', 'payment_status', 'shift_close'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE timesheet_day_code_enum AS ENUM ('Я', 'Н', 'В', 'Б', 'О');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE driver_shift_roster_enum AS ENUM ('shift_1', 'shift_2');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE legal_doc_kind_enum AS ENUM (
        'contract', 'addendum', 'dispute', 'claim', 'template'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE legal_doc_status_enum AS ENUM (
        'draft', 'review', 'active', 'dispute', 'resolved', 'archived'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE knowledge_category_enum AS ENUM (
        'regulations', 'contracts', 'templates', 'disputes', 'fuel_norms', 'maintenance', 'payroll'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE anomaly_severity_enum AS ENUM ('critical', 'warning', 'info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE anomaly_category_enum AS ENUM (
        'shift', 'fuel', 'downtime', 'finance', 'maintenance'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. ТРИГГЕРНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- РАЗДЕЛ 1. УЧАСТКИ, ПОТОКИ ДОКУМЕНТОВ И ПОСТОЯННЫЕ РАСХОДЫ (branch)
-- ============================================================================

-- 1. branch.branches
CREATE TABLE IF NOT EXISTS branch.branches (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(16) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL,
    is_headquarters BOOLEAN NOT NULL DEFAULT FALSE,
    fleet_manager_name VARCHAR(150) NOT NULL,
    fleet_manager_phone VARCHAR(40),
    chief_mechanic_name VARCHAR(150),
    chief_mechanic_phone VARCHAR(40),
    base_address TEXT NOT NULL,
    regular_clients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. branch.branch_document_flows
CREATE TABLE IF NOT EXISTS branch.branch_document_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) UNIQUE NOT NULL REFERENCES branch.branches(id) ON DELETE CASCADE,
    isolated_streams BOOLEAN NOT NULL DEFAULT TRUE,
    isolate_crm_and_erp BOOLEAN NOT NULL DEFAULT TRUE,
    order_prefix VARCHAR(32) NOT NULL DEFAULT 'RO-2026-',
    waybill_prefix VARCHAR(32) NOT NULL DEFAULT 'ПЛ-',
    shift_prefix VARCHAR(32) NOT NULL DEFAULT 'SH-',
    act_prefix VARCHAR(32) NOT NULL DEFAULT 'КС2-',
    onec_department_code VARCHAR(32) NOT NULL DEFAULT '00-000001',
    default_1c_subject accounting_subject_enum NOT NULL DEFAULT 'ooo_specialtech',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. branch.branch_fixed_overheads
CREATE TABLE IF NOT EXISTS branch.branch_fixed_overheads (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id) ON DELETE CASCADE,
    category overhead_category_enum NOT NULL,
    name VARCHAR(255) NOT NULL,
    monthly_amount_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (monthly_amount_rub >= 0),
    note TEXT,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_branch_fixed_overheads_branch ON branch.branch_fixed_overheads(branch_id, category);

-- 4. branch.branch_overhead_details
CREATE TABLE IF NOT EXISTS branch.branch_overhead_details (
    id VARCHAR(64) PRIMARY KEY,
    overhead_item_id VARCHAR(64) NOT NULL REFERENCES branch.branch_fixed_overheads(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    basis TEXT,
    amount_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (amount_rub >= 0)
);

-- 5. branch.branch_period_ledgers
CREATE TABLE IF NOT EXISTS branch.branch_period_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id) ON DELETE CASCADE,
    period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year SMALLINT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
    planned_revenue_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    closed_at TIMESTAMPTZ,
    UNIQUE (branch_id, period_year, period_month)
);

-- ============================================================================
-- РАЗДЕЛ 2. ЗАКАЗЧИКИ И ОБЪЕКТЫ (customer)
-- ============================================================================

-- 6. customer.clients (заказчик изолирован в рамках участка primary_branch_id)
CREATE TABLE IF NOT EXISTS customer.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    client_type client_type_enum NOT NULL DEFAULT 'legal_entity',
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(350),
    opf VARCHAR(32),
    inn VARCHAR(12),
    kpp VARCHAR(9),
    ogrn VARCHAR(15),
    legal_address TEXT,
    director VARCHAR(150),
    bank_name VARCHAR(255),
    bik VARCHAR(9),
    checking_account VARCHAR(32),
    corr_account VARCHAR(32),
    email CITEXT,
    phone VARCHAR(40),
    credit_limit NUMERIC(14,2) NOT NULL DEFAULT 2000000.00,
    current_debt NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    reliability_score SMALLINT NOT NULL DEFAULT 85 CHECK (reliability_score BETWEEN 0 AND 100),
    is_regular_max BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (primary_branch_id, id),
    UNIQUE (primary_branch_id, inn)
);
CREATE INDEX IF NOT EXISTS idx_clients_branch ON customer.clients(primary_branch_id);

-- 7. customer.client_contacts
CREATE TABLE IF NOT EXISTS customer.client_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES customer.clients(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    role_title VARCHAR(100) DEFAULT 'Прораб / Контактное лицо',
    phone VARCHAR(40) NOT NULL,
    max_user_id VARCHAR(100),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE
);

-- 8. customer.construction_sites
CREATE TABLE IF NOT EXISTS customer.construction_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    client_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    geo_lat NUMERIC(10,6),
    geo_lng NUMERIC(10,6),
    geofence_radius_m INTEGER NOT NULL DEFAULT 250,
    site_manager_name VARCHAR(150),
    site_manager_phone VARCHAR(40),
    requires_pass_system BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (branch_id, id),
    CONSTRAINT fk_sites_client_branch FOREIGN KEY (branch_id, client_id)
        REFERENCES customer.clients(primary_branch_id, id) ON DELETE CASCADE
);

-- 9. customer.client_balances_monthly
CREATE TABLE IF NOT EXISTS customer.client_balances_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    client_id UUID NOT NULL,
    period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year SMALLINT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    opening_debt_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    accrued_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    paid_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    closing_debt_rub NUMERIC(14,2) GENERATED ALWAYS AS (opening_debt_rub + accrued_rub - paid_rub) STORED,
    UNIQUE (branch_id, client_id, period_year, period_month),
    CONSTRAINT fk_client_balances_branch FOREIGN KEY (branch_id, client_id)
        REFERENCES customer.clients(primary_branch_id, id) ON DELETE CASCADE
);

-- ============================================================================
-- РАЗДЕЛ 3. ПАРК СПЕЦТЕХНИКИ И ТЕЛЕМЕТРИЯ (fleet)
-- ============================================================================

-- 10. fleet.equipment_categories
CREATE TABLE IF NOT EXISTS fleet.equipment_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code equipment_type_enum UNIQUE NOT NULL,
    name_ru VARCHAR(150) NOT NULL,
    description TEXT
);

-- 11. fleet.equipment
CREATE TABLE IF NOT EXISTS fleet.equipment (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    category_id UUID REFERENCES fleet.equipment_categories(id),
    equipment_type equipment_type_enum NOT NULL,
    inventory_number VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    plate_number VARCHAR(50) NOT NULL,
    vin VARCHAR(32) NOT NULL,
    year SMALLINT NOT NULL CHECK (year BETWEEN 1990 AND 2035),
    owner VARCHAR(255) NOT NULL,
    ownership_type equipment_ownership_enum NOT NULL DEFAULT 'own',
    purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    current_value NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    status equipment_status_enum NOT NULL DEFAULT 'available',
    current_site_id UUID REFERENCES customer.construction_sites(id) ON DELETE SET NULL,
    assigned_site VARCHAR(255),
    assigned_operator VARCHAR(150),
    current_hours NUMERIC(10,1) NOT NULL DEFAULT 0.0,
    month_hours NUMERIC(10,1) NOT NULL DEFAULT 0.0,
    mileage_km_month NUMERIC(10,1) DEFAULT 0.0,
    trips_month INTEGER,
    hourly_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    fuel_rate_hour NUMERIC(8,2) NOT NULL DEFAULT 15.00,
    fuel_cost_month NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    driver_salary_month NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    repair_cost_month NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    transport_cost_month NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    subcontract_cost_month NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    overheads_allocated NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    revenue_month NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    downtime_hours_month NUMERIC(10,1) NOT NULL DEFAULT 0.0,
    next_maintenance_in_hours NUMERIC(10,1) NOT NULL DEFAULT 250.0,
    specs JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id, id),
    UNIQUE (branch_id, inventory_number),
    CONSTRAINT fk_equipment_site_branch FOREIGN KEY (branch_id, current_site_id)
        REFERENCES customer.construction_sites(branch_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS idx_fleet_equipment_branch_status ON fleet.equipment(branch_id, status);

-- 12. fleet.equipment_tariffs
CREATE TABLE IF NOT EXISTS fleet.equipment_tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id VARCHAR(64) NOT NULL REFERENCES fleet.equipment(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    hourly_rate_rub NUMERIC(12,2) NOT NULL,
    shift_rate_rub NUMERIC(12,2),
    fuel_norm_l_hour NUMERIC(8,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 13. fleet.equipment_telemetry_daily
CREATE TABLE IF NOT EXISTS fleet.equipment_telemetry_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    equipment_id VARCHAR(64) NOT NULL REFERENCES fleet.equipment(id) ON DELETE CASCADE,
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    can_engine_hours NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    gps_mileage_km NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    dut_fuel_consumed_l NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    dut_fuel_drained_l NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    idle_engine_minutes INTEGER NOT NULL DEFAULT 0,
    geofence_violations INTEGER NOT NULL DEFAULT 0,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    UNIQUE (equipment_id, doc_date)
);
CREATE INDEX IF NOT EXISTS idx_telemetry_daily_period ON fleet.equipment_telemetry_daily(branch_id, period_day, period_month, period_year);

-- 14. fleet.equipment_telemetry_bindings
CREATE TABLE IF NOT EXISTS fleet.equipment_telemetry_bindings (
    equipment_id VARCHAR(64) PRIMARY KEY REFERENCES fleet.equipment(id) ON DELETE CASCADE,
    tracker_imei VARCHAR(32) UNIQUE NOT NULL,
    dut_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    can_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(16) NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline')),
    last_packet_at TIMESTAMPTZ
);

-- ============================================================================
-- РАЗДЕЛ 4. ОБОРУДОВАНИЕ, ТО И РЕМОНТЫ (maintenance)
-- ============================================================================

-- 15. maintenance.service_schedules
CREATE TABLE IF NOT EXISTS maintenance.service_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    equipment_id VARCHAR(64) NOT NULL REFERENCES fleet.equipment(id) ON DELETE CASCADE,
    interval_hours NUMERIC(8,1) NOT NULL DEFAULT 250.0,
    last_service_hours NUMERIC(10,1) NOT NULL DEFAULT 0.0,
    next_service_hours NUMERIC(10,1) NOT NULL DEFAULT 250.0,
    warning_threshold_hours NUMERIC(8,1) NOT NULL DEFAULT 25.0
);

-- 16. maintenance.maintenance_logs
CREATE TABLE IF NOT EXISTS maintenance.maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    equipment_id VARCHAR(64) NOT NULL REFERENCES fleet.equipment(id) ON DELETE CASCADE,
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    maintenance_type VARCHAR(40) NOT NULL CHECK (maintenance_type IN ('scheduled_to', 'breakdown_repair', 'inspection', 'modernization')),
    engine_hours_at_service NUMERIC(10,1) NOT NULL,
    description TEXT NOT NULL,
    parts_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    service_contractor VARCHAR(200),
    downtime_hours NUMERIC(8,1) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_maint_logs_period ON maintenance.maintenance_logs(branch_id, period_month, period_year);

-- 17. maintenance.spare_parts_usage
CREATE TABLE IF NOT EXISTS maintenance.spare_parts_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    maintenance_log_id UUID NOT NULL REFERENCES maintenance.maintenance_logs(id) ON DELETE CASCADE,
    equipment_id VARCHAR(64) NOT NULL REFERENCES fleet.equipment(id),
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    part_name VARCHAR(255) NOT NULL,
    part_sku VARCHAR(80),
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    total_cost_rub NUMERIC(12,2) NOT NULL DEFAULT 0.00
);

-- ============================================================================
-- РАЗДЕЛ 5. ВОДИТЕЛИ, ТАБЕЛЬ И КОРПОРАТИВНЫЕ КАРТЫ (driver)
-- ============================================================================

-- 18. driver.drivers
CREATE TABLE IF NOT EXISTS driver.drivers (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    max_linked BOOLEAN NOT NULL DEFAULT TRUE,
    shift_roster driver_shift_roster_enum NOT NULL DEFAULT 'shift_1',
    needs_replacement BOOLEAN NOT NULL DEFAULT FALSE,
    replacement_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id, id)
);
CREATE INDEX IF NOT EXISTS idx_drivers_branch ON driver.drivers(branch_id);

-- 19. driver.driver_equipment_bindings (строго в пределах одного участка branch_id)
CREATE TABLE IF NOT EXISTS driver.driver_equipment_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    driver_id VARCHAR(64) NOT NULL,
    equipment_id VARCHAR(64) NOT NULL,
    is_temporary_replacement BOOLEAN NOT NULL DEFAULT FALSE,
    set_by_role VARCHAR(32) CHECK (set_by_role IN ('fleet_manager', 'director_admin')),
    reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (driver_id, equipment_id, is_temporary_replacement),
    CONSTRAINT fk_drv_bind_driver_branch FOREIGN KEY (branch_id, driver_id)
        REFERENCES driver.drivers(branch_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_drv_bind_eq_branch FOREIGN KEY (branch_id, equipment_id)
        REFERENCES fleet.equipment(branch_id, id) ON DELETE CASCADE
);

-- 20. driver.driver_timesheet_days
CREATE TABLE IF NOT EXISTS driver.driver_timesheet_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    driver_id VARCHAR(64) NOT NULL,
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    day_code timesheet_day_code_enum NOT NULL DEFAULT 'Я',
    worked_hours NUMERIC(5,2) NOT NULL DEFAULT 8.00,
    UNIQUE (driver_id, doc_date),
    CONSTRAINT fk_timesheet_driver_branch FOREIGN KEY (branch_id, driver_id)
        REFERENCES driver.drivers(branch_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_driver_timesheet_period ON driver.driver_timesheet_days(branch_id, period_month, period_year);

-- 21. driver.driver_cards
CREATE TABLE IF NOT EXISTS driver.driver_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    driver_id VARCHAR(64) NOT NULL,
    card_last4 VARCHAR(4) NOT NULL,
    monthly_limit_rub NUMERIC(12,2) NOT NULL DEFAULT 150000.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (branch_id, id),
    UNIQUE (branch_id, driver_id, card_last4),
    CONSTRAINT fk_cards_driver_branch FOREIGN KEY (branch_id, driver_id)
        REFERENCES driver.drivers(branch_id, id) ON DELETE CASCADE
);

-- 22. driver.driver_card_transactions (подотчёт водителя: участок + техника + карта + заказчик + перелив ГСМ внутри участка)
CREATE TABLE IF NOT EXISTS driver.driver_card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    card_id UUID REFERENCES driver.driver_cards(id),
    driver_id VARCHAR(64) NOT NULL,
    source_equipment_id VARCHAR(64) NOT NULL,
    target_equipment_id VARCHAR(64),
    target_driver_id VARCHAR(64),
    shift_report_id VARCHAR(64),
    client_id UUID,
    order_id VARCHAR(64),
    deal_id VARCHAR(64),
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    payment_category payment_category_enum NOT NULL,
    liters NUMERIC(10,2),
    amount_rub NUMERIC(12,2) NOT NULL CHECK (amount_rub >= 0),
    reallocated_to_target BOOLEAN NOT NULL DEFAULT FALSE,
    site_name VARCHAR(255),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_card_tx_driver_branch FOREIGN KEY (branch_id, driver_id)
        REFERENCES driver.drivers(branch_id, id),
    CONSTRAINT fk_card_tx_card_branch FOREIGN KEY (branch_id, card_id)
        REFERENCES driver.driver_cards(branch_id, id),
    CONSTRAINT fk_card_tx_source_eq_branch FOREIGN KEY (branch_id, source_equipment_id)
        REFERENCES fleet.equipment(branch_id, id),
    CONSTRAINT fk_card_tx_target_eq_branch FOREIGN KEY (branch_id, target_equipment_id)
        REFERENCES fleet.equipment(branch_id, id),
    CONSTRAINT fk_card_tx_target_drv_branch FOREIGN KEY (branch_id, target_driver_id)
        REFERENCES driver.drivers(branch_id, id),
    CONSTRAINT fk_card_tx_client_branch FOREIGN KEY (branch_id, client_id)
        REFERENCES customer.clients(primary_branch_id, id)
);
CREATE INDEX IF NOT EXISTS idx_card_tx_period ON driver.driver_card_transactions(branch_id, period_day, period_month, period_year);

-- 23. driver.driver_payroll_monthly
CREATE TABLE IF NOT EXISTS driver.driver_payroll_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    driver_id VARCHAR(64) NOT NULL REFERENCES driver.drivers(id) ON DELETE CASCADE,
    period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year SMALLINT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    total_hours NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    accrued_salary_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    card_balance_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    fuel_discrepancy_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (branch_id, driver_id, period_year, period_month)
);

-- ============================================================================
-- РАЗДЕЛ 6. СУБАРЕНДА / ПРИВЛЕЧЁННАЯ ТЕХНИКА ЧАСТНИКА (subrent)
-- ============================================================================

-- 24. subrent.private_contractors
CREATE TABLE IF NOT EXISTS subrent.private_contractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    name VARCHAR(255) NOT NULL,
    legal_form VARCHAR(32) NOT NULL CHECK (legal_form IN ('individual', 'self_employed', 'ip', 'ooo')),
    inn VARCHAR(12),
    phone VARCHAR(40) NOT NULL,
    bank_requisites TEXT
);

-- 25. subrent.subrent_contracts
CREATE TABLE IF NOT EXISTS subrent.subrent_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    contractor_id UUID NOT NULL REFERENCES subrent.private_contractors(id),
    accounting_subject accounting_subject_enum NOT NULL DEFAULT 'ooo_specialtech',
    contract_number VARCHAR(64) UNIQUE NOT NULL,
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    hourly_cost_rub NUMERIC(12,2) NOT NULL,
    payment_terms TEXT DEFAULT 'После оплаты заказчиком и подписания ЭСМ-7'
);

-- 26. subrent.subrent_equipment
CREATE TABLE IF NOT EXISTS subrent.subrent_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    contractor_id UUID NOT NULL REFERENCES subrent.private_contractors(id) ON DELETE CASCADE,
    equipment_id VARCHAR(64) NOT NULL,
    purchase_hourly_rate_rub NUMERIC(12,2) NOT NULL,
    target_margin_delta_rub NUMERIC(12,2) NOT NULL DEFAULT 500.00,
    CONSTRAINT fk_subrent_eq_branch FOREIGN KEY (branch_id, equipment_id)
        REFERENCES fleet.equipment(branch_id, id) ON DELETE CASCADE
);

-- 27. subrent.subrent_shifts
CREATE TABLE IF NOT EXISTS subrent.subrent_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    subrent_contract_id UUID NOT NULL REFERENCES subrent.subrent_contracts(id),
    equipment_id VARCHAR(64) NOT NULL REFERENCES fleet.equipment(id),
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    worked_hours NUMERIC(6,2) NOT NULL,
    subcontract_cost_rub NUMERIC(14,2) NOT NULL
);

-- 28. subrent.subrent_settlements
CREATE TABLE IF NOT EXISTS subrent.subrent_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    contractor_id UUID NOT NULL REFERENCES subrent.private_contractors(id),
    subrent_contract_id UUID NOT NULL REFERENCES subrent.subrent_contracts(id),
    period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year SMALLINT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    accrued_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    paid_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    UNIQUE (contractor_id, subrent_contract_id, period_year, period_month)
);

-- ============================================================================
-- РАЗДЕЛ 7. КОНТУР CRM, ЧАТ И КЛИЕНТ-БОТ MAX (crm)
-- ============================================================================

-- 29. crm.deals
CREATE TABLE IF NOT EXISTS crm.deals (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    client_id UUID REFERENCES customer.clients(id),
    client_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(150) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    client_type client_type_enum NOT NULL DEFAULT 'legal_entity',
    has_contract BOOLEAN NOT NULL DEFAULT TRUE,
    accounting_subject accounting_subject_enum NOT NULL DEFAULT 'ooo_specialtech',
    equipment_type equipment_type_enum NOT NULL,
    equipment_assigned_id VARCHAR(64) REFERENCES fleet.equipment(id) ON DELETE SET NULL,
    assigned_driver_id VARCHAR(64) REFERENCES driver.drivers(id) ON DELETE SET NULL,
    assigned_driver_name VARCHAR(150),
    assigned_driver_phone VARCHAR(40),
    driver_assignment_mode VARCHAR(32) CHECK (driver_assignment_mode IN ('default_single', 'timesheet_shift', 'manager_replacement')),
    hours_requested INTEGER NOT NULL CHECK (hours_requested > 0),
    shifts_requested INTEGER,
    hourly_rate_agreed NUMERIC(12,2) NOT NULL CHECK (hourly_rate_agreed >= 0),
    estimated_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    stage crm_stage_enum NOT NULL DEFAULT 'lead',
    debt_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    site_address TEXT NOT NULL,
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    manager VARCHAR(150) NOT NULL,
    closed_shift_hours_total NUMERIC(10,2) DEFAULT 0.00,
    closed_volume_hours NUMERIC(10,2),
    act_signed BOOLEAN NOT NULL DEFAULT FALSE,
    act_number VARCHAR(64),
    ks2_number VARCHAR(64),
    ks3_number VARCHAR(64),
    act_saved_to_base BOOLEAN NOT NULL DEFAULT FALSE,
    ks2_saved_to_base BOOLEAN NOT NULL DEFAULT FALSE,
    ks3_saved_to_base BOOLEAN NOT NULL DEFAULT FALSE,
    invoice_number VARCHAR(64),
    invoice_date DATE,
    invoice_status invoice_status_enum NOT NULL DEFAULT 'not_issued',
    invoice_saved_to_base BOOLEAN NOT NULL DEFAULT FALSE,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    stage_updated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id, id),
    CONSTRAINT fk_deals_client_branch FOREIGN KEY (branch_id, client_id)
        REFERENCES customer.clients(primary_branch_id, id),
    CONSTRAINT fk_deals_eq_branch FOREIGN KEY (branch_id, equipment_assigned_id)
        REFERENCES fleet.equipment(branch_id, id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_deals_drv_branch FOREIGN KEY (branch_id, assigned_driver_id)
        REFERENCES driver.drivers(branch_id, id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS idx_crm_deals_branch_stage ON crm.deals(branch_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_deals_period ON crm.deals(branch_id, period_month, period_year);

-- 30. crm.deal_shift_logs (макс. 2 смены на дату, от 1 до 12 ч)
CREATE TABLE IF NOT EXISTS crm.deal_shift_logs (
    id VARCHAR(64) PRIMARY KEY,
    deal_id VARCHAR(64) NOT NULL REFERENCES crm.deals(id) ON DELETE CASCADE,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    shift_slot SMALLINT NOT NULL CHECK (shift_slot IN (1, 2)),
    hours NUMERIC(4,1) NOT NULL CHECK (hours >= 1 AND hours <= 12),
    closed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (deal_id, doc_date, shift_slot)
);

-- 31. crm.deal_stage_history
CREATE TABLE IF NOT EXISTS crm.deal_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id VARCHAR(64) NOT NULL REFERENCES crm.deals(id) ON DELETE CASCADE,
    from_stage crm_stage_enum,
    to_stage crm_stage_enum NOT NULL,
    changed_by VARCHAR(150) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 32. crm.client_communications (сообщения чата, бот MAX, вложения)
CREATE TABLE IF NOT EXISTS crm.client_communications (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    deal_id VARCHAR(64) REFERENCES crm.deals(id) ON DELETE SET NULL,
    doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    sender_name VARCHAR(150) NOT NULL,
    sender_role VARCHAR(32) NOT NULL CHECK (sender_role IN ('admin', 'fleet_manager', 'driver', 'client')),
    message_text TEXT NOT NULL,
    attachment JSONB,
    confirmation JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_comm_branch ON crm.client_communications(branch_id, created_at DESC);

-- 33. crm.deal_confirmations
CREATE TABLE IF NOT EXISTS crm.deal_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    deal_id VARCHAR(64) REFERENCES crm.deals(id) ON DELETE CASCADE,
    doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    confirmation_type VARCHAR(32) NOT NULL CHECK (confirmation_type IN ('hours', 'shift_close', 'volume_trips')),
    label VARCHAR(200) NOT NULL,
    value_text VARCHAR(100) NOT NULL,
    approved_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 34. crm.max_customer_bot_configs
CREATE TABLE IF NOT EXISTS crm.max_customer_bot_configs (
    branch_id VARCHAR(64) PRIMARY KEY REFERENCES branch.branches(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    allow_new_rental_requests BOOLEAN NOT NULL DEFAULT TRUE,
    allow_shift_hour_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
    allow_site_chat_and_photos BOOLEAN NOT NULL DEFAULT TRUE,
    auto_route_to_1c BOOLEAN NOT NULL DEFAULT TRUE,
    require_manager_moderation BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- РАЗДЕЛ 8. КОНТУР ERP, ЮРИДИЧЕСКИЙ РЕЕСТР, 1С И УВЕДОМЛЕНИЯ (erp)
-- ============================================================================

-- 35. erp.accounting_subjects
CREATE TABLE IF NOT EXISTS erp.accounting_subjects (
    id accounting_subject_enum PRIMARY KEY,
    entity_name VARCHAR(200) NOT NULL,
    short_name VARCHAR(100) NOT NULL,
    tax_system VARCHAR(100) NOT NULL,
    inn VARCHAR(12) NOT NULL,
    odata_url TEXT NOT NULL,
    api_login VARCHAR(100) NOT NULL,
    api_secret_encrypted TEXT,
    exchange_format VARCHAR(32) NOT NULL DEFAULT 'odata_v3' CHECK (exchange_format IN ('odata_v3', 'rest_http_service')),
    auto_sync_docs BOOLEAN NOT NULL DEFAULT TRUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    connection_status VARCHAR(24) NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error')),
    routing_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_checked_at TIMESTAMPTZ
);

-- 36. erp.contracts (Юридический реестр: общий контур «Договоры и юротдел» — branch_id опционален)
CREATE TABLE IF NOT EXISTS erp.contracts (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) REFERENCES branch.branches(id),
    client_id UUID REFERENCES customer.clients(id),
    number VARCHAR(64) NOT NULL,
    title VARCHAR(300) NOT NULL,
    kind legal_doc_kind_enum NOT NULL DEFAULT 'contract',
    counterparty VARCHAR(255) NOT NULL,
    accounting_subject accounting_subject_enum NOT NULL DEFAULT 'ooo_specialtech',
    status legal_doc_status_enum NOT NULL DEFAULT 'active',
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    author_name VARCHAR(150) NOT NULL,
    amount_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    dispute_amount_rub NUMERIC(14,2),
    dispute_reason TEXT,
    linked_order_number VARCHAR(64),
    in_knowledge_base BOOLEAN NOT NULL DEFAULT FALSE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_erp_contracts_branch ON erp.contracts(branch_id, kind, status);

-- 37. erp.legal_disputes (споры/претензии общего юридического контура — branch_id опционален)
CREATE TABLE IF NOT EXISTS erp.legal_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) REFERENCES branch.branches(id),
    contract_id VARCHAR(64) REFERENCES erp.contracts(id) ON DELETE SET NULL,
    client_id UUID REFERENCES customer.clients(id),
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    claim_amount_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    reason TEXT NOT NULL,
    status legal_doc_status_enum NOT NULL DEFAULT 'dispute'
);

-- 38. erp.legal_history
CREATE TABLE IF NOT EXISTS erp.legal_history (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES erp.contracts(id) ON DELETE CASCADE,
    document_number VARCHAR(64) NOT NULL,
    document_title VARCHAR(300) NOT NULL,
    action VARCHAR(32) NOT NULL CHECK (action IN ('created', 'updated', 'imported', 'exported', 'saved_to_base', 'status_changed', 'dispute_opened')),
    actor_role system_role_enum NOT NULL,
    actor_name VARCHAR(150) NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 39. erp.rental_orders
CREATE TABLE IF NOT EXISTS erp.rental_orders (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    deal_id VARCHAR(64) REFERENCES crm.deals(id) ON DELETE SET NULL,
    contract_id VARCHAR(64) REFERENCES erp.contracts(id) ON DELETE SET NULL,
    client_id UUID REFERENCES customer.clients(id),
    site_id UUID REFERENCES customer.construction_sites(id),
    equipment_id VARCHAR(64) NOT NULL,
    driver_id VARCHAR(64),
    order_number VARCHAR(64) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_type client_type_enum NOT NULL DEFAULT 'legal_entity',
    has_contract BOOLEAN NOT NULL DEFAULT TRUE,
    accounting_subject accounting_subject_enum NOT NULL DEFAULT 'ooo_specialtech',
    operator_name VARCHAR(150) NOT NULL,
    site_address TEXT NOT NULL,
    doc_date DATE NOT NULL,
    end_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    planned_hours INTEGER NOT NULL DEFAULT 0,
    actual_hours NUMERIC(10,1) NOT NULL DEFAULT 0.0,
    closed_volume_hours NUMERIC(10,1),
    hourly_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status order_status_enum NOT NULL DEFAULT 'active',
    act_signed BOOLEAN NOT NULL DEFAULT FALSE,
    paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    act_number VARCHAR(64),
    ks2_number VARCHAR(64),
    ks3_number VARCHAR(64),
    act_saved_to_base BOOLEAN NOT NULL DEFAULT FALSE,
    ks2_saved_to_base BOOLEAN NOT NULL DEFAULT FALSE,
    ks3_saved_to_base BOOLEAN NOT NULL DEFAULT FALSE,
    invoice_number VARCHAR(64),
    invoice_date DATE,
    invoice_status invoice_status_enum NOT NULL DEFAULT 'not_issued',
    invoice_saved_to_base BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id, id),
    UNIQUE (branch_id, order_number),
    CONSTRAINT fk_orders_client_branch FOREIGN KEY (branch_id, client_id)
        REFERENCES customer.clients(primary_branch_id, id),
    CONSTRAINT fk_orders_site_branch FOREIGN KEY (branch_id, site_id)
        REFERENCES customer.construction_sites(branch_id, id),
    CONSTRAINT fk_orders_eq_branch FOREIGN KEY (branch_id, equipment_id)
        REFERENCES fleet.equipment(branch_id, id),
    CONSTRAINT fk_orders_drv_branch FOREIGN KEY (branch_id, driver_id)
        REFERENCES driver.drivers(branch_id, id)
);
CREATE INDEX IF NOT EXISTS idx_rental_orders_branch_status ON erp.rental_orders(branch_id, status);

-- 40. erp.cost_allocations_monthly
CREATE TABLE IF NOT EXISTS erp.cost_allocations_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    equipment_id VARCHAR(64) NOT NULL REFERENCES fleet.equipment(id) ON DELETE CASCADE,
    period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year SMALLINT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    revenue_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    fuel_cost_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    driver_salary_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    repair_cost_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    transport_cost_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    subcontract_cost_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    overheads_allocated_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    operating_profit_rub NUMERIC(14,2) GENERATED ALWAYS AS (
        revenue_rub - (fuel_cost_rub + driver_salary_rub + repair_cost_rub + transport_cost_rub + subcontract_cost_rub) - overheads_allocated_rub
    ) STORED,
    UNIQUE (branch_id, equipment_id, period_year, period_month)
);

-- 41. erp.onec_sync_logs
CREATE TABLE IF NOT EXISTS erp.onec_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    accounting_subject accounting_subject_enum NOT NULL,
    doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    onec_department_code VARCHAR(32) NOT NULL,
    sync_status VARCHAR(24) NOT NULL DEFAULT 'queued' CHECK (sync_status IN ('queued', 'synced', 'failed')),
    response_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 42. erp.status_notification_settings
CREATE TABLE IF NOT EXISTS erp.status_notification_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    on_volume_close_act_ks2 BOOLEAN NOT NULL DEFAULT TRUE,
    on_act_signed_change BOOLEAN NOT NULL DEFAULT TRUE,
    on_invoice_issued BOOLEAN NOT NULL DEFAULT TRUE,
    on_invoice_status_change BOOLEAN NOT NULL DEFAULT TRUE,
    send_to_branch_chat BOOLEAN NOT NULL DEFAULT TRUE,
    send_to_max_client_bot BOOLEAN NOT NULL DEFAULT FALSE,
    remind_debt_overdue_days INTEGER NOT NULL DEFAULT 5 CHECK (remind_debt_overdue_days BETWEEN 1 AND 90)
);

-- 43. erp.status_notifications
CREATE TABLE IF NOT EXISTS erp.status_notifications (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    doc_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category notification_category_enum NOT NULL,
    entity_label VARCHAR(150) NOT NULL,
    channels TEXT[] NOT NULL DEFAULT ARRAY['erp'],
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- РАЗДЕЛ 9. РАЗДЕЛЬНЫЕ ПЕРВИЧНЫЕ ФОРМЫ И ЗАКРЫВАЮЩИЕ ДОКУМЕНТЫ (forms)
-- ============================================================================

-- 44. forms.shift_reports (Форма 1 — Сменные рапорты ЭСМ-7 и поток MAX-бота водителя: участок + техника + водитель + карта + заказчик)
CREATE TABLE IF NOT EXISTS forms.shift_reports (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    order_id VARCHAR(64) REFERENCES erp.rental_orders(id) ON DELETE SET NULL,
    deal_id VARCHAR(64),
    client_id UUID,
    client_name VARCHAR(255),
    equipment_id VARCHAR(64) NOT NULL,
    driver_id VARCHAR(64),
    card_id UUID,
    card_last4 VARCHAR(4),
    site_id UUID,
    shift_number VARCHAR(64) NOT NULL,
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    operator_name VARCHAR(150) NOT NULL,
    driver_phone VARCHAR(40),
    site_name VARCHAR(255) NOT NULL,
    shift_start_time VARCHAR(16),
    work_start_time VARCHAR(16),
    work_end_time VARCHAR(16),
    relocation_hours NUMERIC(6,2) DEFAULT 0.00,
    start_hours NUMERIC(10,1) NOT NULL,
    end_hours NUMERIC(10,1) NOT NULL,
    work_hours NUMERIC(6,2) NOT NULL,
    downtime_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    downtime_reason TEXT,
    mileage_km NUMERIC(8,1),
    trips_count INTEGER,
    fuel_liters_added NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    fuel_hourly_calculated NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    payment_category payment_category_enum,
    payment_target_equipment_id VARCHAR(64),
    payment_amount_rub NUMERIC(12,2),
    subcontract_cost_rub NUMERIC(12,2),
    payment_comment TEXT,
    chat_note TEXT,
    waybill_generated BOOLEAN NOT NULL DEFAULT FALSE,
    waybill_number VARCHAR(64),
    photo_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status shift_status_enum NOT NULL DEFAULT 'pending',
    anomaly_message TEXT,
    calculated_salary NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id, id),
    UNIQUE (branch_id, shift_number),
    CONSTRAINT fk_shifts_eq_branch FOREIGN KEY (branch_id, equipment_id)
        REFERENCES fleet.equipment(branch_id, id),
    CONSTRAINT fk_shifts_target_eq_branch FOREIGN KEY (branch_id, payment_target_equipment_id)
        REFERENCES fleet.equipment(branch_id, id),
    CONSTRAINT fk_shifts_drv_branch FOREIGN KEY (branch_id, driver_id)
        REFERENCES driver.drivers(branch_id, id),
    CONSTRAINT fk_shifts_card_branch FOREIGN KEY (branch_id, card_id)
        REFERENCES driver.driver_cards(branch_id, id),
    CONSTRAINT fk_shifts_order_branch FOREIGN KEY (branch_id, order_id)
        REFERENCES erp.rental_orders(branch_id, id),
    CONSTRAINT fk_shifts_deal_branch FOREIGN KEY (branch_id, deal_id)
        REFERENCES crm.deals(branch_id, id),
    CONSTRAINT fk_shifts_client_branch FOREIGN KEY (branch_id, client_id)
        REFERENCES customer.clients(primary_branch_id, id),
    CONSTRAINT fk_shifts_site_branch FOREIGN KEY (branch_id, site_id)
        REFERENCES customer.construction_sites(branch_id, id)
);
CREATE INDEX IF NOT EXISTS idx_shift_reports_period ON forms.shift_reports(branch_id, period_day, period_month, period_year);

-- 45. forms.waybills (Форма 2 — Путевые листы ПЛ)
CREATE TABLE IF NOT EXISTS forms.waybills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    shift_report_id VARCHAR(64),
    equipment_id VARCHAR(64) NOT NULL,
    driver_id VARCHAR(64),
    waybill_number VARCHAR(64) NOT NULL,
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    departure_time TIMESTAMPTZ,
    return_time TIMESTAMPTZ,
    odometer_start_km NUMERIC(10,1) DEFAULT 0,
    odometer_end_km NUMERIC(10,1) DEFAULT 0,
    fuel_start_l NUMERIC(8,2) DEFAULT 0,
    fuel_refueled_l NUMERIC(8,2) DEFAULT 0,
    fuel_end_l NUMERIC(8,2) DEFAULT 0,
    medical_check_passed BOOLEAN NOT NULL DEFAULT TRUE,
    mechanic_release_passed BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (branch_id, id),
    UNIQUE (branch_id, waybill_number),
    CONSTRAINT fk_waybills_shift_branch FOREIGN KEY (branch_id, shift_report_id)
        REFERENCES forms.shift_reports(branch_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_waybills_eq_branch FOREIGN KEY (branch_id, equipment_id)
        REFERENCES fleet.equipment(branch_id, id),
    CONSTRAINT fk_waybills_drv_branch FOREIGN KEY (branch_id, driver_id)
        REFERENCES driver.drivers(branch_id, id)
);

-- 46. forms.closing_documents (Форма 3 — Акт оказанных услуг, КС-2 ОКУД 0322005, КС-3 ОКУД 0322001, Счёт)
CREATE TABLE IF NOT EXISTS forms.closing_documents (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    kind closing_doc_kind_enum NOT NULL,
    doc_number VARCHAR(64) NOT NULL,
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    source_type VARCHAR(16) NOT NULL CHECK (source_type IN ('order', 'deal')),
    source_id VARCHAR(64) NOT NULL,
    order_or_deal_number VARCHAR(64) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_inn VARCHAR(12),
    client_address TEXT,
    site_address TEXT NOT NULL,
    equipment_name VARCHAR(255) NOT NULL,
    operator_name VARCHAR(150) NOT NULL,
    work_description TEXT NOT NULL,
    unit_label VARCHAR(32) NOT NULL DEFAULT 'маш.-час',
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity >= 0),
    rate_rub NUMERIC(12,2) NOT NULL CHECK (rate_rub >= 0),
    total_amount_rub NUMERIC(14,2) NOT NULL CHECK (total_amount_rub >= 0),
    vat_amount_rub NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (vat_amount_rub >= 0),
    accounting_subject accounting_subject_enum NOT NULL DEFAULT 'ooo_specialtech',
    saved_to_base BOOLEAN NOT NULL DEFAULT TRUE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invoice_status invoice_status_enum,
    paid_amount_rub NUMERIC(14,2),
    printed_count INTEGER NOT NULL DEFAULT 0,
    content_text TEXT NOT NULL,
    UNIQUE (branch_id, id),
    UNIQUE (branch_id, kind, doc_number)
);
CREATE INDEX IF NOT EXISTS idx_closing_docs_branch_kind ON forms.closing_documents(branch_id, kind, doc_date);

-- 47. forms.work_act_items
CREATE TABLE IF NOT EXISTS forms.work_act_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    closing_document_id VARCHAR(64) NOT NULL,
    shift_report_id VARCHAR(64) REFERENCES forms.shift_reports(id) ON DELETE SET NULL,
    waybill_id UUID REFERENCES forms.waybills(id) ON DELETE SET NULL,
    equipment_id VARCHAR(64),
    quantity NUMERIC(10,2) NOT NULL,
    rate_rub NUMERIC(12,2) NOT NULL,
    line_amount_rub NUMERIC(14,2) NOT NULL,
    CONSTRAINT fk_work_act_items_cdoc_branch FOREIGN KEY (branch_id, closing_document_id)
        REFERENCES forms.closing_documents(branch_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_work_act_items_eq_branch FOREIGN KEY (branch_id, equipment_id)
        REFERENCES fleet.equipment(branch_id, id)
);

-- ============================================================================
-- РАЗДЕЛ 10. АУДИТ ГСМ И АНОМАЛИИ (audit)
-- ============================================================================

-- 48. audit.anomaly_alerts
CREATE TABLE IF NOT EXISTS audit.anomaly_alerts (
    id VARCHAR(64) PRIMARY KEY,
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    equipment_id VARCHAR(64) REFERENCES fleet.equipment(id) ON DELETE SET NULL,
    shift_report_id VARCHAR(64) REFERENCES forms.shift_reports(id) ON DELETE SET NULL,
    severity anomaly_severity_enum NOT NULL,
    category anomaly_category_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    equipment_name VARCHAR(255),
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    impact_rubles NUMERIC(14,2) DEFAULT 0.00,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_branch_resolved ON audit.anomaly_alerts(branch_id, resolved);

-- 49. audit.fuel_audit_logs
CREATE TABLE IF NOT EXISTS audit.fuel_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) NOT NULL REFERENCES branch.branches(id),
    equipment_id VARCHAR(64) NOT NULL REFERENCES fleet.equipment(id),
    shift_report_id VARCHAR(64) REFERENCES forms.shift_reports(id) ON DELETE SET NULL,
    driver_id VARCHAR(64) REFERENCES driver.drivers(id),
    doc_date DATE NOT NULL,
    period_day SMALLINT GENERATED ALWAYS AS (EXTRACT(DAY FROM doc_date)::SMALLINT) STORED,
    period_month SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM doc_date)::SMALLINT) STORED,
    period_year SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM doc_date)::SMALLINT) STORED,
    norm_liters NUMERIC(10,2) NOT NULL,
    fact_liters NUMERIC(10,2) NOT NULL,
    deviation_liters NUMERIC(10,2) GENERATED ALWAYS AS (fact_liters - norm_liters) STORED,
    deviation_rub NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    driver_notified BOOLEAN NOT NULL DEFAULT TRUE,
    driver_reported BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- РАЗДЕЛ 11. БАЗА ЗНАНИЙ И ВЕКТОРНЫЙ ПОИСК RAG (rag)
-- ============================================================================

-- 50. rag.knowledge_documents
CREATE TABLE IF NOT EXISTS rag.knowledge_documents (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(300) NOT NULL,
    category knowledge_category_enum NOT NULL,
    date_updated DATE NOT NULL DEFAULT CURRENT_DATE,
    excerpt TEXT NOT NULL,
    full_text TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    source_uri TEXT
);

-- 51. rag.document_chunks
CREATE TABLE IF NOT EXISTS rag.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(64) NOT NULL REFERENCES rag.knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (document_id, chunk_index)
);

-- Безопасное подключение pgvector (768 dim) если расширение установлено на сервере PostgreSQL,
-- иначе создание резервного массива DOUBLE PRECISION[] чтобы скрипт не падал на чистом PostgreSQL 17
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        CREATE EXTENSION IF NOT EXISTS vector;
        ALTER TABLE rag.document_chunks ADD COLUMN IF NOT EXISTS embedding vector(768);
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
            ON rag.document_chunks USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
    ELSE
        ALTER TABLE rag.document_chunks ADD COLUMN IF NOT EXISTS embedding_fallback DOUBLE PRECISION[];
        RAISE NOTICE 'pgvector не установлен в PostgreSQL — добавлена колонка embedding_fallback DOUBLE PRECISION[].';
    END IF;
END $$;

-- 52. rag.retrieval_logs
CREATE TABLE IF NOT EXISTS rag.retrieval_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) REFERENCES branch.branches(id),
    agent_type VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    top_k SMALLINT NOT NULL DEFAULT 5,
    matched_chunk_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- РАЗДЕЛ 12. ПОЛЬЗОВАТЕЛИ, RBAC, СИСТЕМНЫЙ КОНФИГ И РЕЕСТР ТАБЛИЦ (meta)
-- ============================================================================

-- 53. meta.users
CREATE TABLE IF NOT EXISTS meta.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(64) REFERENCES branch.branches(id),
    email CITEXT UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role system_role_enum NOT NULL DEFAULT 'fleet_manager',
    phone VARCHAR(40),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 54. meta.role_access_policies
CREATE TABLE IF NOT EXISTS meta.role_access_policies (
    role_code system_role_enum PRIMARY KEY,
    label VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    pages JSONB NOT NULL,
    fields JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 55. meta.system_admin_config (Таблицы, LLM, RAG, ГЛОНАСС/ДУТ/CAN и глобальный флаг подтверждения)
CREATE TABLE IF NOT EXISTS meta.system_admin_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    tables_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    llm_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    rag_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    telemetry_sensors_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    admin_confirmation_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 56. meta.table_registry
CREATE TABLE IF NOT EXISTS meta.table_registry (
    id SERIAL PRIMARY KEY,
    schema_name VARCHAR(32) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    full_table_name VARCHAR(140) UNIQUE NOT NULL,
    contour VARCHAR(64) NOT NULL,
    hierarchy_slice VARCHAR(120) NOT NULL,
    description TEXT NOT NULL
);

-- ============================================================================
-- 4.1. ОТЛОЖЕННЫЕ МЕЖСХЕМНЫЕ ВНЕШНИЕ КЛЮЧИ (ПОСЛЕ СОЗДАНИЯ ВСЕХ 56 ТАБЛИЦ)
-- Замыкают 5-звенную изоляцию потока водителя/карты/смен в пределах branch_id
-- ============================================================================
DO $$ BEGIN
    ALTER TABLE driver.driver_card_transactions
        ADD CONSTRAINT fk_card_tx_deal_branch FOREIGN KEY (branch_id, deal_id)
        REFERENCES crm.deals(branch_id, id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE driver.driver_card_transactions
        ADD CONSTRAINT fk_card_tx_order_branch FOREIGN KEY (branch_id, order_id)
        REFERENCES erp.rental_orders(branch_id, id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE driver.driver_card_transactions
        ADD CONSTRAINT fk_card_tx_shift_branch FOREIGN KEY (branch_id, shift_report_id)
        REFERENCES forms.shift_reports(branch_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 5. АНАЛИТИЧЕСКИЕ ПРЕДСТАВЛЕНИЯ (SQL VIEWS)
-- ============================================================================

CREATE OR REPLACE VIEW erp.v_equipment_monthly_pnl AS
SELECT
    e.id AS equipment_id,
    e.branch_id,
    b.code AS branch_code,
    e.inventory_number,
    e.name,
    e.equipment_type,
    e.status,
    e.month_hours,
    e.mileage_km_month,
    e.trips_month,
    e.revenue_month,
    (e.fuel_cost_month + e.driver_salary_month + e.repair_cost_month + e.transport_cost_month + e.subcontract_cost_month) AS direct_costs_month,
    e.overheads_allocated,
    (e.revenue_month - (e.fuel_cost_month + e.driver_salary_month + e.repair_cost_month + e.transport_cost_month + e.subcontract_cost_month) - e.overheads_allocated) AS operating_profit_month,
    CASE WHEN e.revenue_month > 0
         THEN ROUND(((e.revenue_month - (e.fuel_cost_month + e.driver_salary_month + e.repair_cost_month + e.transport_cost_month + e.subcontract_cost_month) - e.overheads_allocated) / e.revenue_month) * 100, 1)
         ELSE 0 END AS margin_percent
FROM fleet.equipment e
JOIN branch.branches b ON b.id = e.branch_id;

CREATE OR REPLACE VIEW erp.v_branches_consolidated_pnl AS
SELECT
    b.id AS branch_id,
    b.code AS branch_code,
    b.name AS branch_name,
    COUNT(e.id) AS equipment_count,
    COALESCE(SUM(e.month_hours), 0) AS total_hours,
    COALESCE(SUM(e.revenue_month), 0) AS total_revenue,
    COALESCE(SUM(e.fuel_cost_month + e.driver_salary_month + e.repair_cost_month + e.transport_cost_month + e.subcontract_cost_month), 0) AS total_direct_costs,
    COALESCE((SELECT SUM(fo.monthly_amount_rub) FROM branch.branch_fixed_overheads fo WHERE fo.branch_id = b.id AND fo.hidden = FALSE), 0) AS fixed_overheads_monthly,
    COALESCE(SUM(e.overheads_allocated), 0) AS equipment_overheads
FROM branch.branches b
LEFT JOIN fleet.equipment e ON e.branch_id = b.id
GROUP BY b.id, b.code, b.name;

CREATE OR REPLACE VIEW erp.v_unresolved_anomalies_and_debt AS
SELECT
    b.code AS branch_code,
    COUNT(DISTINCT a.id) FILTER (WHERE a.resolved = FALSE) AS unresolved_anomalies_count,
    COALESCE(SUM(d.debt_amount) FILTER (WHERE d.archived_at IS NULL), 0) AS active_crm_debt_rub,
    COALESCE((SELECT SUM(o.total_amount - o.paid_amount) FROM erp.rental_orders o WHERE o.branch_id = b.id AND o.total_amount > o.paid_amount), 0) AS orders_debt_rub
FROM branch.branches b
LEFT JOIN audit.anomaly_alerts a ON a.branch_id = b.id
LEFT JOIN crm.deals d ON d.branch_id = b.id
GROUP BY b.id, b.code;
