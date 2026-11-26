-- ============================================================================
-- SPECIALTECH AI ERP — МИГРАЦИЯ НАЧАЛЬНЫХ ДАННЫХ (PostgreSQL 15+ / 17+)
-- Версия: 2.1.0 (Совместимо со схемой db/schema.sql v2.1.0 — 12 схем, 56 таблиц)
-- Порядок выполнения: psql -U postgres -d specialtech_erp -f db/schema.sql
--                     psql -U postgres -d specialtech_erp -f db/data_migration.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. ИДЕМПОТЕНТНАЯ ОЧИСТКА ТАБЛИЦ
-- ----------------------------------------------------------------------------
TRUNCATE TABLE
    meta.table_registry,
    meta.system_admin_config,
    meta.role_access_policies,
    meta.users,
    rag.retrieval_logs,
    rag.document_chunks,
    rag.knowledge_documents,
    audit.fuel_audit_logs,
    audit.anomaly_alerts,
    forms.work_act_items,
    forms.closing_documents,
    forms.waybills,
    forms.shift_reports,
    erp.status_notifications,
    erp.status_notification_settings,
    erp.onec_sync_logs,
    erp.cost_allocations_monthly,
    erp.rental_orders,
    erp.legal_history,
    erp.legal_disputes,
    erp.contracts,
    erp.accounting_subjects,
    crm.max_customer_bot_configs,
    crm.deal_confirmations,
    crm.client_communications,
    crm.deal_stage_history,
    crm.deal_shift_logs,
    crm.deals,
    driver.driver_card_transactions,
    driver.driver_cards,
    driver.driver_timesheet_days,
    driver.driver_equipment_bindings,
    driver.drivers,
    fleet.equipment_telemetry_bindings,
    fleet.equipment_telemetry_daily,
    fleet.equipment_tariffs,
    fleet.equipment,
    fleet.equipment_categories,
    customer.construction_sites,
    customer.client_contacts,
    customer.clients,
    branch.branch_period_ledgers,
    branch.branch_overhead_details,
    branch.branch_fixed_overheads,
    branch.branch_document_flows,
    branch.branches
RESTART IDENTITY CASCADE;

-- ----------------------------------------------------------------------------
-- 1. УЧАСТКИ И ФИЛИАЛЫ (branch)
-- ----------------------------------------------------------------------------
INSERT INTO branch.branches (
    id, code, name, city, is_headquarters, fleet_manager_name, fleet_manager_phone, chief_mechanic_name, chief_mechanic_phone, base_address, regular_clients
) VALUES
    ('branch-hq', 'MSK', 'Центральный участок «Москва»', 'Москва', TRUE, 'Орлов П. С.', '+7 (495) 700-10-10',
     'Григорьев А. Н.', '+7 (495) 700-10-12',
     'г. Москва, Промышленный проезд, д. 14',
     ARRAY['ООО «Монолит-Строй»', 'АО «Автодор-Инвест»', 'ООО «ГрандСтройИнвест»', 'ООО «ДорСтройХолдинг»']),
    ('branch-kzn', 'KZN', 'Филиал «Поволжье» (Казань)', 'Казань', FALSE, 'Волков И. А.', '+7 (843) 200-20-20',
     'Зарипов Р. Ф.', '+7 (843) 200-20-22',
     'г. Казань, ул. Техническая, д. 52',
     ARRAY['ООО «ТатСтройМост»', 'АО «КазаньПромИнвест»', 'ООО «ВолгаДорСервис»']);

INSERT INTO branch.branch_document_flows (
    branch_id, isolated_streams, isolate_crm_and_erp, order_prefix, waybill_prefix, shift_prefix, act_prefix, onec_department_code, default_1c_subject
) VALUES
    ('branch-hq', TRUE, TRUE, 'RO-MSK-2026-', 'ПЛ-MSK-', 'SH-MSK-', 'КС2-MSK-', '00-000001', 'ooo_specialtech'),
    ('branch-kzn', TRUE, TRUE, 'RO-KZN-2026-', 'ПЛ-KZN-', 'SH-KZN-', 'КС2-KZN-', '00-000002', 'ooo_specialtech');

INSERT INTO branch.branch_fixed_overheads (id, branch_id, category, name, monthly_amount_rub, note) VALUES
    ('ovh-sal-hq', 'branch-hq', 'office_itr_salary', 'Зарплата офис и ИТР (Fleet Manager, ИТР, бухгалтерия)', 400000.00, 'Без водителей и слесарей ремонта'),
    ('ovh-aho-hq', 'branch-hq', 'aho', 'Аренда офиса, бытовки, канцелярия и оргтехника', 185000.00, NULL),
    ('ovh-leasing-hq', 'branch-hq', 'leasing', 'Лизинг спецтехники и автопарка', 320000.00, NULL),
    ('ovh-taxes-hq', 'branch-hq', 'taxes', 'Налоги и обязательные сборы участка', 115000.00, NULL),
    ('ovh-oth-hq', 'branch-hq', 'other', 'Охрана, предрейсовый медик и ПО/ГЛОНАСС', 85000.00, NULL),
    ('ovh-sal-kzn', 'branch-kzn', 'office_itr_salary', 'Зарплата офис и ИТР филиала', 255000.00, NULL),
    ('ovh-aho-kzn', 'branch-kzn', 'aho', 'Аренда офиса и оргтехника (Казань)', 95000.00, NULL),
    ('ovh-leasing-kzn', 'branch-kzn', 'leasing', 'Лизинг спецтехники филиала', 180000.00, NULL),
    ('ovh-taxes-kzn', 'branch-kzn', 'taxes', 'Налоги и сборы филиала', 65000.00, NULL),
    ('ovh-oth-kzn', 'branch-kzn', 'other', 'Охрана, медик и ГЛОНАСС', 45000.00, NULL);

-- ----------------------------------------------------------------------------
-- 2. СУБЪЕКТЫ БУХГАЛТЕРИИ 1С (erp.accounting_subjects)
-- ----------------------------------------------------------------------------
INSERT INTO erp.accounting_subjects (
    id, entity_name, short_name, tax_system, inn, odata_url, api_login, exchange_format, auto_sync_docs, enabled, connection_status, routing_rules
) VALUES
    ('ooo_specialtech', 'ООО «SpecialTech»', 'ООО SpecialTech', 'ОСНО (с НДС 20%)', '7701234567',
     'https://1c.specialtech.local/ooo_base/odata/standard.odata', 'odata_ooo_sync', 'odata_v3', TRUE, TRUE, 'connected',
     '{"legalEntityTarget":"ooo_specialtech","individualWithContractTarget":"ip_specialtechnica","individualWithoutContractTarget":"ip_specialtechnica","allowIndividualWithoutContract":true,"requireContractForLegalEntity":true}'::jsonb),
    ('ip_specialtechnica', 'ИП «SpecialTechnica»', 'ИП SpecialTechnica', 'УСН 6% (Без НДС)', '770198765432',
     'https://1c.specialtech.local/ip_base/odata/standard.odata', 'odata_ip_sync', 'odata_v3', TRUE, TRUE, 'connected',
     '{"legalEntityTarget":"ooo_specialtech","individualWithContractTarget":"ip_specialtechnica","individualWithoutContractTarget":"ip_specialtechnica","allowIndividualWithoutContract":true,"requireContractForLegalEntity":true}'::jsonb);

-- ----------------------------------------------------------------------------
-- 3. ПОЛЬЗОВАТЕЛИ, РОЛИ RBAC И КОНФИГ АДМИНИСТРАТОРА (meta)
-- ----------------------------------------------------------------------------
INSERT INTO meta.users (id, branch_id, email, hashed_password, full_name, role, phone) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'branch-hq', 'admin@specialtech.ru', '$2b$12$e80yq9k4k4GqVnN5L7uNqeO6W9Jb8F9l.Nn7S1x1Z6e9w8f0d7e6u', 'Михаил Семенов (Администратор)', 'admin', '+7 (999) 111-22-33'),
    ('a0000000-0000-0000-0000-000000000002', NULL, 'director@specialtech.ru', '$2b$12$e80yq9k4k4GqVnN5L7uNqeO6W9Jb8F9l.Nn7S1x1Z6e9w8f0d7e6u', 'Воронов И. В. (Руководитель / Директор)', 'top_manager', '+7 (999) 222-33-44'),
    ('a0000000-0000-0000-0000-000000000003', 'branch-hq', 'fm.msk@specialtech.ru', '$2b$12$e80yq9k4k4GqVnN5L7uNqeO6W9Jb8F9l.Nn7S1x1Z6e9w8f0d7e6u', 'Орлов П. С. (Fleet Manager МСК)', 'fleet_manager', '+7 (495) 700-10-10'),
    ('a0000000-0000-0000-0000-000000000004', 'branch-kzn', 'fm.kzn@specialtech.ru', '$2b$12$e80yq9k4k4GqVnN5L7uNqeO6W9Jb8F9l.Nn7S1x1Z6e9w8f0d7e6u', 'Волков И. А. (Fleet Manager КЗН)', 'fleet_manager', '+7 (843) 200-20-20'),
    ('a0000000-0000-0000-0000-000000000005', 'branch-hq', 'lawyer@specialtech.ru', '$2b$12$e80yq9k4k4GqVnN5L7uNqeO6W9Jb8F9l.Nn7S1x1Z6e9w8f0d7e6u', 'Соловьёва А. В. (Юрист)', 'lawyer', '+7 (999) 444-55-66'),
    ('a0000000-0000-0000-0000-000000000006', 'branch-hq', 'accountant@specialtech.ru', '$2b$12$e80yq9k4k4GqVnN5L7uNqeO6W9Jb8F9l.Nn7S1x1Z6e9w8f0d7e6u', 'Кузнецова О. В. (Бухгалтер)', 'accountant', '+7 (999) 333-44-55');

INSERT INTO meta.role_access_policies (role_code, label, description, pages, fields) VALUES
    ('admin', 'Администратор системы', 'Полный доступ ко всем контурам, таблицам затрат, LLM и телеметрии',
     '{"dashboard":"edit","fleet_manager":"edit","fleet":"edit","rentals":"edit","contracts":"edit","crm":"edit","timesheets":"edit","chat":"edit","ai_analyst":"edit","knowledge":"edit","branches":"edit","integrations_1c":"edit","admin_panel":"edit"}'::jsonb,
     '{"canViewFinancialMargin":true,"canEditPayroll":true,"canApproveShifts":true,"canViewDriverMaxPhones":true,"canEditKnowledgeBase":true,"canAccessFixedCostsTable":true,"canAccessVariableCostsTable":true}'::jsonb),
    ('top_manager', 'Руководитель (Топ-менеджер)', 'Консолидированный P&L по всем филиалам, AI-аналитик, таблицы затрат',
     '{"dashboard":"edit","fleet_manager":"view","fleet":"edit","rentals":"edit","contracts":"edit","crm":"edit","timesheets":"edit","chat":"edit","ai_analyst":"edit","knowledge":"edit","branches":"edit","integrations_1c":"view","admin_panel":"view"}'::jsonb,
     '{"canViewFinancialMargin":true,"canEditPayroll":true,"canApproveShifts":true,"canViewDriverMaxPhones":true,"canEditKnowledgeBase":true,"canAccessFixedCostsTable":true,"canAccessVariableCostsTable":true}'::jsonb),
    ('fleet_manager', 'Начальник участка (Fleet Manager)', 'Изолированное управление техникой, сменами, заменами водителей и CRM участка',
     '{"dashboard":"view","fleet_manager":"edit","fleet":"edit","rentals":"edit","contracts":"view","crm":"edit","timesheets":"edit","chat":"edit","ai_analyst":"view","knowledge":"view","branches":"view","integrations_1c":"hidden","admin_panel":"hidden"}'::jsonb,
     '{"canViewFinancialMargin":false,"canEditPayroll":false,"canApproveShifts":true,"canViewDriverMaxPhones":true,"canEditKnowledgeBase":false,"canAccessFixedCostsTable":false,"canAccessVariableCostsTable":false}'::jsonb),
    ('lawyer', 'Юрист / Правовой отдел', 'Договора, допсоглашения, претензии, обезличивание и публикация в Базу знаний',
     '{"dashboard":"hidden","fleet_manager":"hidden","fleet":"view","rentals":"view","contracts":"edit","crm":"view","timesheets":"hidden","chat":"view","ai_analyst":"view","knowledge":"edit","branches":"hidden","integrations_1c":"view","admin_panel":"hidden"}'::jsonb,
     '{"canViewFinancialMargin":false,"canEditPayroll":false,"canApproveShifts":false,"canViewDriverMaxPhones":false,"canEditKnowledgeBase":true,"canAccessFixedCostsTable":false,"canAccessVariableCostsTable":false}'::jsonb),
    ('accountant', 'Бухгалтер (1С и закрывающие)', 'Закрывающие документы Акт/КС-2/КС-3/Счёт, сверка 1С ООО и ИП',
     '{"dashboard":"view","fleet_manager":"hidden","fleet":"view","rentals":"edit","contracts":"view","crm":"view","timesheets":"view","chat":"view","ai_analyst":"view","knowledge":"view","branches":"view","integrations_1c":"edit","admin_panel":"hidden"}'::jsonb,
     '{"canViewFinancialMargin":true,"canEditPayroll":true,"canApproveShifts":false,"canViewDriverMaxPhones":false,"canEditKnowledgeBase":false,"canAccessFixedCostsTable":true,"canAccessVariableCostsTable":true}'::jsonb),
    ('driver', 'Водитель / Машинист (Бот MAX)', 'Подача смен, фото счётчика, платежи корпоративных карт и перелив ГСМ',
     '{"dashboard":"hidden","fleet_manager":"hidden","fleet":"hidden","rentals":"hidden","contracts":"hidden","crm":"hidden","timesheets":"view","chat":"edit","ai_analyst":"hidden","knowledge":"view","branches":"hidden","integrations_1c":"hidden","admin_panel":"hidden"}'::jsonb,
     '{"canViewFinancialMargin":false,"canEditPayroll":false,"canApproveShifts":false,"canViewDriverMaxPhones":false,"canEditKnowledgeBase":false,"canAccessFixedCostsTable":false,"canAccessVariableCostsTable":false}'::jsonb);

INSERT INTO meta.system_admin_config (id, llm_config, rag_config, telemetry_sensors_config, admin_confirmation_allowed) VALUES
    (1,
     '{"provider":"gemini_proxy","model":"gemini-4-hydrogen","proxyEndpoint":"/api/ai-analyst","serverTokenEnvVar":"GEMINI_API_KEY","maxOutputTokens":4096,"contextWindowTokens":128000,"thinkingTokenBudget":1024,"temperature":0.2,"topP":0.9}'::jsonb,
     '{"storageMode":"local_hybrid","vectorEngine":"faiss_hnsw","embeddingModel":"text-embedding-004","chunkSizeTokens":512,"chunkOverlapTokens":64,"topK":5,"minSimilarity":0.72}'::jsonb,
     '{"enabled":true,"provider":"wialon_ips","protocol":"wialon_ips_v2","endpointUrl":"https://telematics.specialtech.local/api/v2","serverPort":20332,"pollIntervalSec":30,"fuelDrainThresholdLiters":15,"hourMeterTolerancePercent":8,"geofenceRadiusMeters":250}'::jsonb,
     TRUE);

-- ----------------------------------------------------------------------------
-- 4. КАТЕГОРИИ И ПАРК ТЕХНИКИ + ПРИВЯЗКИ ГЛОНАСС (fleet)
-- ----------------------------------------------------------------------------
INSERT INTO fleet.equipment_categories (code, name_ru, description) VALUES
    ('excavator', 'Экскаваторы', 'Гусеничные и колёсные экскаваторы 18–35 т'),
    ('crane', 'Автокраны', 'Стреловые автомобильные краны 25–90 т'),
    ('dump_truck', 'Самосвалы', 'Самосвалы 20–32 м³'),
    ('loader', 'Погрузчики', 'Фронтальные и экскаваторы-погрузчики'),
    ('bulldozer', 'Бульдозеры', 'Гусеничные планировщики'),
    ('cherry_picker', 'Автовышки', 'Автогидроподъёмники 18–45 м');

INSERT INTO fleet.equipment (
    id, branch_id, equipment_type, inventory_number, name, brand, plate_number, vin, year, owner, ownership_type,
    status, assigned_site, assigned_operator, current_hours, month_hours, mileage_km_month, trips_month,
    hourly_rate, fuel_rate_hour, fuel_cost_month, driver_salary_month, repair_cost_month, transport_cost_month,
    overheads_allocated, revenue_month, downtime_hours_month, next_maintenance_in_hours, specs
) VALUES
    ('eq-1', 'branch-hq', 'excavator', 'EXC-14', 'Komatsu PC210NLC-8', 'Komatsu', 'Е 384 СВ 777', 'KMTPC210X8849201', 2021, 'ООО «СпецТехЛизинг»', 'leasing',
     'rented', 'ЖК «Северный квартал»', 'Соколов В. П.', 5420.0, 182.0, 120.0, NULL,
     3400.00, 17.5, 206000.00, 100100.00, 24000.00, 12000.00, 48000.00, 618800.00, 8.0, 180.0, '{"capacity":"22 т","weight":"22100 кг"}'::jsonb),
    ('eq-2', 'branch-hq', 'crane', 'CRN-05', 'Liebherr LTM 1050-3.1', 'Liebherr', 'В 341 КТ 77', 'WLFA31Z00051290', 2020, 'Собственный парк', 'own',
     'rented', 'Мостовой переход М-12', 'Козырев М. В.', 6120.0, 168.0, 420.0, NULL,
     4800.00, 18.0, 196560.00, 117600.00, 32000.00, 25000.00, 52000.00, 806400.00, 10.0, 130.0, '{"capacity":"50 т","boomLength":"38 м","weight":"36000 кг"}'::jsonb),
    ('eq-4', 'branch-hq', 'dump_truck', 'TRK-22', 'КАМАЗ 6520 (20 м³)', 'КАМАЗ', 'М 554 СО 777', 'XTC652004L129402', 2021, 'Собственный парк', 'own',
     'rented', 'Трасса М-12 км 48', 'Громов П. С.', 5400.0, 198.0, 4850.0, 146,
     2400.00, 14.5, 186615.00, 99000.00, 18000.00, 0.00, 32000.00, 475200.00, 14.0, 100.0, '{"capacity":"20 м³","weight":"12950 кг"}'::jsonb),
    ('eq-kzn-1', 'branch-kzn', 'excavator', 'KZN-EXC-01', 'Hitachi ZX240-5G', 'Hitachi', 'К 102 АН 116', 'HCMZX240P0019283', 2022, 'Собственный парк', 'own',
     'rented', 'Мост через р. Казанка', 'Сафин Р. М.', 3180.0, 174.0, 90.0, NULL,
     3500.00, 18.2, 205842.00, 95700.00, 15000.00, 18000.00, 38000.00, 609000.00, 6.0, 120.0, '{"capacity":"25 т","weight":"24600 кг"}'::jsonb);

INSERT INTO fleet.equipment_telemetry_bindings (equipment_id, tracker_imei, dut_enabled, can_enabled, status) VALUES
    ('eq-1', '864290041120911', TRUE, TRUE, 'online'),
    ('eq-2', '864290041120922', TRUE, TRUE, 'online'),
    ('eq-4', '864290041120944', TRUE, TRUE, 'online'),
    ('eq-kzn-1', '864290041120955', TRUE, TRUE, 'online');

-- ----------------------------------------------------------------------------
-- 5. ВОДИТЕЛИ И ЗАКРЕПЛЕНИЯ (driver)
-- ----------------------------------------------------------------------------
INSERT INTO driver.drivers (id, branch_id, name, phone, max_linked, shift_roster) VALUES
    ('drv-1', 'branch-hq', 'Соколов В. П.', '+7 (916) 201-44-10', TRUE, 'shift_1'),
    ('drv-2', 'branch-hq', 'Козырев М. В.', '+7 (916) 312-55-20', TRUE, 'shift_1'),
    ('drv-4', 'branch-hq', 'Громов П. С.', '+7 (926) 440-18-99', TRUE, 'shift_1'),
    ('drv-kzn-1', 'branch-kzn', 'Сафин Р. М.', '+7 (917) 880-11-33', TRUE, 'shift_1');

INSERT INTO driver.driver_equipment_bindings (branch_id, driver_id, equipment_id) VALUES
    ('branch-hq', 'drv-1', 'eq-1'),
    ('branch-hq', 'drv-2', 'eq-2'),
    ('branch-hq', 'drv-4', 'eq-4'),
    ('branch-kzn', 'drv-kzn-1', 'eq-kzn-1');

INSERT INTO driver.driver_cards (branch_id, driver_id, card_last4, monthly_limit_rub, is_active) VALUES
    ('branch-hq', 'drv-1', '4819', 150000.00, TRUE),
    ('branch-hq', 'drv-2', '1809', 150000.00, TRUE),
    ('branch-hq', 'drv-4', '7720', 180000.00, TRUE),
    ('branch-kzn', 'drv-kzn-1', '4401', 150000.00, TRUE);

-- ----------------------------------------------------------------------------
-- 6. ЗАКАЗЧИКИ, ОБЪЕКТЫ, CRM И СДЕЛКИ (customer, crm)
-- ----------------------------------------------------------------------------
INSERT INTO customer.clients (id, primary_branch_id, client_type, name, full_name, opf, inn, kpp, ogrn, phone, email, is_regular_max) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'branch-hq', 'legal_entity', 'ООО «Монолит-Строй»',
     'Общество с ограниченной ответственностью «Монолит-Строй»', 'ООО', '7713998877', '771301001', '1187746990112',
     '+7 (495) 781-44-12', 'docs@monolit-demo.ru', TRUE),
    ('d0000000-0000-0000-0000-000000000002', 'branch-kzn', 'legal_entity', 'ООО «ТатСтройМост»',
     'Общество с ограниченной ответственностью «ТатСтройМост»', 'ООО', '1655998877', '165501001', '1161690887766',
     '+7 (843) 518-22-40', 'office@tatstroymost-demo.ru', TRUE);

INSERT INTO crm.deals (
    id, branch_id, client_id, client_name, contact_person, phone, client_type, has_contract, accounting_subject,
    equipment_type, equipment_assigned_id, assigned_driver_id, assigned_driver_name, assigned_driver_phone,
    hours_requested, shifts_requested, hourly_rate_agreed, estimated_amount, stage, debt_amount, paid_amount, site_address, doc_date, manager
) VALUES
    ('deal-1', 'branch-hq', 'd0000000-0000-0000-0000-000000000001', 'ООО «Монолит-Строй»', 'Захаров Роман Олегович', '+7 (495) 781-44-12',
     'legal_entity', TRUE, 'ooo_specialtech', 'excavator', 'eq-1', 'drv-1', 'Соколов В. П.', '+7 (916) 201-44-10',
     160, 20, 3400.00, 544000.00, 'active', 120000.00, 424000.00, 'Москва, ЖК «Северный квартал»', '2026-11-01', 'Орлов П. С.'),
    ('deal-kzn-1', 'branch-kzn', 'd0000000-0000-0000-0000-000000000002', 'ООО «ТатСтройМост»', 'Халиуллин Марат Рамилевич', '+7 (843) 518-22-40',
     'legal_entity', TRUE, 'ooo_specialtech', 'excavator', 'eq-kzn-1', 'drv-kzn-1', 'Сафин Р. М.', '+7 (917) 880-11-33',
     180, 22, 3500.00, 630000.00, 'active', 0.00, 630000.00, 'г. Казань, Мост через р. Казанка', '2026-11-02', 'Волков И. А.');

INSERT INTO crm.max_customer_bot_configs (branch_id) VALUES ('branch-hq'), ('branch-kzn');

-- ----------------------------------------------------------------------------
-- 7. ДОГОВОРЫ, ЗАКАЗЫ, РАПОРТЫ, ЗАКРЫВАЮЩИЕ ДОКУМЕНТЫ (erp, forms, audit)
-- ----------------------------------------------------------------------------
INSERT INTO erp.contracts (
    id, branch_id, client_id, number, title, kind, counterparty, accounting_subject, status, doc_date, author_name, amount_rub, linked_order_number, content
) VALUES
    ('leg-1', 'branch-hq', 'd0000000-0000-0000-0000-000000000001', 'RO-MSK-2026-001',
     'Договор аренды строительной спецтехники с экипажем № RO-MSK-2026-001', 'contract', 'ООО «Монолит-Строй»',
     'ooo_specialtech', 'active', '2026-11-01', 'Соловьёва А. В.', 544000.00, 'RO-MSK-2026-001',
     'Договор аренды строительных машин и механизмов с экипажем между ООО «SpecialTech» и ООО «Монолит-Строй».');

INSERT INTO erp.rental_orders (
    id, branch_id, deal_id, contract_id, client_id, equipment_id, driver_id, order_number, client_name,
    client_type, has_contract, accounting_subject, operator_name, site_address, doc_date, end_date,
    planned_hours, actual_hours, hourly_rate, status, act_signed, paid_amount, total_amount, ks2_number, ks3_number, invoice_number, invoice_status
) VALUES
    ('ord-1', 'branch-hq', 'deal-1', 'leg-1', 'd0000000-0000-0000-0000-000000000001', 'eq-1', 'drv-1',
     'RO-MSK-2026-001', 'ООО «Монолит-Строй»', 'legal_entity', TRUE, 'ooo_specialtech', 'Соколов В. П.',
     'Москва, ЖК «Северный квартал»', '2026-11-01', '2026-11-30',
     160, 182.0, 3400.00, 'active', TRUE, 424000.00, 618800.00, 'КС2-MSK-001', 'КС3-MSK-001', 'СЧ-MSK-001', 'partially_paid');

INSERT INTO forms.shift_reports (
    id, branch_id, order_id, deal_id, client_id, client_name, equipment_id, driver_id, card_last4, shift_number, doc_date, operator_name, site_name,
    start_hours, end_hours, work_hours, downtime_hours, fuel_liters_added, fuel_hourly_calculated,
    payment_category, payment_amount_rub, waybill_generated, waybill_number, photo_verified, status, calculated_salary
) VALUES
    ('sh-1', 'branch-hq', 'ord-1', 'deal-1', 'd0000000-0000-0000-0000-000000000001', 'ООО «Монолит-Строй»',
     'eq-1', 'drv-1', '4819', 'SH-MSK-001', '2026-11-20', 'Соколов В. П.',
     'Москва, ЖК «Северный квартал»', 5408.0, 5420.0, 12.0, 0.0, 205.0, 17.1,
     'fuel_own_tank', 13325.00, TRUE, 'ПЛ-MSK-001', TRUE, 'approved', 6600.00);

INSERT INTO forms.closing_documents (
    id, branch_id, kind, doc_number, doc_date, period_start, period_end, source_type, source_id,
    order_or_deal_number, client_name, site_address, equipment_name, operator_name, work_description,
    unit_label, quantity, rate_rub, total_amount_rub, vat_amount_rub, accounting_subject, invoice_status, paid_amount_rub, content_text
) VALUES
    ('cdoc-ks2-1', 'branch-hq', 'ks2', 'КС2-MSK-001', '2026-11-20', '2026-11-01', '2026-11-20', 'order', 'ord-1',
     'RO-MSK-2026-001', 'ООО «Монолит-Строй»', 'Москва, ЖК «Северный квартал»', 'Komatsu PC210NLC-8', 'Соколов В. П.',
     'Услуги экскаватора Komatsu PC210NLC-8 с экипажем', 'маш.-час', 182.0, 3400.00, 618800.00, 103133.33, 'ooo_specialtech', NULL, NULL,
     'Унифицированная форма № КС-2 (ОКУД 0322005) — 182 м/ч на сумму 618 800,00 руб. в т.ч. НДС 20%.'),
    ('cdoc-ks3-1', 'branch-hq', 'ks3', 'КС3-MSK-001', '2026-11-20', '2026-11-01', '2026-11-20', 'order', 'ord-1',
     'RO-MSK-2026-001', 'ООО «Монолит-Строй»', 'Москва, ЖК «Северный квартал»', 'Komatsu PC210NLC-8', 'Соколов В. П.',
     'Справка о стоимости выполненных работ и затрат № КС-3', 'маш.-час', 182.0, 3400.00, 618800.00, 103133.33, 'ooo_specialtech', NULL, NULL,
     'Унифицированная форма № КС-3 (ОКУД 0322001) — стоимость работ 618 800,00 руб.');

INSERT INTO erp.status_notification_settings (id) VALUES (1);

INSERT INTO audit.anomaly_alerts (
    id, branch_id, equipment_id, severity, category, title, description, equipment_name, doc_date, impact_rubles
) VALUES
    ('anom-1', 'branch-hq', 'eq-4', 'critical', 'fuel', 'Отклонение расхода ДТ +46 л по КАМАЗ 6520',
     'Фактическое списание по карте превышает норму ГСМ и показания ДУТ. Требуется отчёт водителя к закрытию месяца.',
     'КАМАЗ 6520 (20 м³)', '2026-11-20', 3120.00);

-- ----------------------------------------------------------------------------
-- 8. БАЗА ЗНАНИЙ RAG И РЕЕСТР ТАБЛИЦ (rag, meta.table_registry)
-- ----------------------------------------------------------------------------
INSERT INTO rag.knowledge_documents (id, code, title, category, excerpt, full_text, tags) VALUES
    ('kb-1', 'REG-FIN-01', 'Регламент расчёта юнит-экономики и постоянных расходов участков', 'regulations',
     'Операционная прибыль = Выручка - Прямые затраты (ГСМ, ЗП, Ремонт, Трал, Субподряд) - Постоянные расходы участка.',
     'В системе SpecialTech AI ERP выделены 5 категорий постоянных расходов: Зарплата офис и ИТР (без водителей и слесарей ремонта), АХЧ, Лизинг, Налоги, Прочие.',
     ARRAY['P&L', 'финансы', 'маржа', 'постоянные расходы']),
    ('kb-2', 'REG-GSM-02', 'Неблокирующий аудит ГСМ и внутрипарковый перелив топлива', 'fuel_norms',
     'При перерасходе ГСМ (>10% или порог ДУТ) техника не блокируется; перелив переносится на принимающую технику.',
     'При выборе в форме смены/бота категории Платежи «Перелив / ГСМ для техники парка» стоимость относится на принимающую единицу техники.',
     ARRAY['ГСМ', 'ДУТ', 'перелив', 'карты']);

INSERT INTO rag.document_chunks (document_id, chunk_index, content, token_count, metadata) VALUES
    ('kb-1', 0, 'Операционная прибыль = Выручка - (ГСМ + ЗП + Ремонт + Трал + Субподряд) - Постоянные расходы (Офис/ИТР, АХЧ, Лизинг, Налоги, Прочие).', 48, '{"category":"regulations"}'::jsonb),
    ('kb-2', 0, 'При отклонении ГСМ > 10% техника не блокируется. Создаётся alert в audit.anomaly_alerts и запись в audit.fuel_audit_logs для ежемесячного отчёта водителя.', 52, '{"category":"fuel_norms"}'::jsonb);

INSERT INTO meta.table_registry (schema_name, table_name, full_table_name, contour, hierarchy_slice, description) VALUES
    ('branch', 'branches', 'branch.branches', 'Участки', 'Справочник', 'Участки и филиалы парка'),
    ('branch', 'branch_document_flows', 'branch.branch_document_flows', 'Участки', 'По участку', 'Префиксы документов и код подразделения 1С'),
    ('branch', 'branch_fixed_overheads', 'branch.branch_fixed_overheads', 'Участки', 'По участку', '5 категорий постоянных расходов участка'),
    ('branch', 'branch_overhead_details', 'branch.branch_overhead_details', 'Участки', 'По статье', 'Детализация постоянных расходов'),
    ('branch', 'branch_period_ledgers', 'branch.branch_period_ledgers', 'Участки', 'Участок -> Месяц -> Год', 'Учётные периоды участка'),
    ('customer', 'clients', 'customer.clients', 'Заказчик', 'По участку', 'Карточки заказчиков ЮЛ и ФЛ'),
    ('customer', 'client_contacts', 'customer.client_contacts', 'Заказчик', 'Справочник', 'Контактные лица и ID в боте MAX'),
    ('customer', 'construction_sites', 'customer.construction_sites', 'Заказчик', 'По участку', 'Строительные объекты и геозоны'),
    ('customer', 'client_balances_monthly', 'customer.client_balances_monthly', 'Заказчик', 'Участок -> Месяц -> Год', 'Помесячное сальдо расчётов'),
    ('fleet', 'equipment_categories', 'fleet.equipment_categories', 'Техника', 'Справочник', 'Типы спецтехники'),
    ('fleet', 'equipment', 'fleet.equipment', 'Техника', 'По участку', 'Паспорта техники и ежемесячная экономика'),
    ('fleet', 'equipment_tariffs', 'fleet.equipment_tariffs', 'Техника', 'По технике', 'Ставки и нормы ГСМ'),
    ('fleet', 'equipment_telemetry_daily', 'fleet.equipment_telemetry_daily', 'Техника', 'Участок -> День -> Месяц -> Год', 'Суточная телеметрия ГЛОНАСС/ДУТ/CAN'),
    ('fleet', 'equipment_telemetry_bindings', 'fleet.equipment_telemetry_bindings', 'Техника', 'По технике', 'Привязка IMEI трекеров, ДУТ и CAN-шины'),
    ('maintenance', 'service_schedules', 'maintenance.service_schedules', 'ТО и ремонт', 'По технике', 'Регламенты ТО по моточасам'),
    ('maintenance', 'maintenance_logs', 'maintenance.maintenance_logs', 'ТО и ремонт', 'Участок -> День -> Месяц -> Год', 'Журнал плановых ТО и ремонтов'),
    ('maintenance', 'spare_parts_usage', 'maintenance.spare_parts_usage', 'ТО и ремонт', 'Участок -> День -> Месяц -> Год', 'Учёт запчастей и узлов'),
    ('driver', 'drivers', 'driver.drivers', 'Водитель', 'По участку', 'Водители, телефоны MAX, смены 1/2'),
    ('driver', 'driver_equipment_bindings', 'driver.driver_equipment_bindings', 'Водитель', 'По участку', 'Закрепление за техникой и замены'),
    ('driver', 'driver_timesheet_days', 'driver.driver_timesheet_days', 'Водитель', 'Участок -> День -> Месяц -> Год', 'Дневной табель Я/Н/В/Б/О'),
    ('driver', 'driver_cards', 'driver.driver_cards', 'Водитель', 'По участку', 'Корпоративные карты подотчёта водителей (last4, лимит)'),
    ('driver', 'driver_card_transactions', 'driver.driver_card_transactions', 'Водитель', 'Участок -> День -> Месяц -> Год', 'Подотчёт по картам (участок + техника + заказчик/смена), ГСМ, переливы, запчасти'),
    ('driver', 'driver_payroll_monthly', 'driver.driver_payroll_monthly', 'Водитель', 'Участок -> Месяц -> Год', 'Помесячный расчёт ЗП и подотчёта'),
    ('subrent', 'private_contractors', 'subrent.private_contractors', 'Субаренда', 'По участку', 'Частники и партнёры со своей техникой'),
    ('subrent', 'subrent_contracts', 'subrent.subrent_contracts', 'Субаренда', 'Участок -> День -> Месяц -> Год', 'Договоры субаренды с частником'),
    ('subrent', 'subrent_equipment', 'subrent.subrent_equipment', 'Субаренда', 'По подрядчику', 'Привлечённая техника и дельта'),
    ('subrent', 'subrent_shifts', 'subrent.subrent_shifts', 'Субаренда', 'Участок -> День -> Месяц -> Год', 'Смены привлечённой техники'),
    ('subrent', 'subrent_settlements', 'subrent.subrent_settlements', 'Субаренда', 'Участок -> Месяц -> Год', 'Взаиморасчёты с частниками'),
    ('crm', 'deals', 'crm.deals', 'CRM', 'Участок -> День -> Месяц -> Год', 'Воронка сделок, архив 48 ч, закрывающие флаги'),
    ('crm', 'deal_shift_logs', 'crm.deal_shift_logs', 'CRM', 'Участок -> День -> Месяц -> Год', 'Закрытие смен по заявке CRM (до 2 в день)'),
    ('crm', 'deal_stage_history', 'crm.deal_stage_history', 'CRM', 'Журнал', 'История переходов стадий CRM'),
    ('crm', 'client_communications', 'crm.client_communications', 'CRM', 'Участок -> День -> Месяц -> Год', 'Операционный чат, бот MAX и вложения'),
    ('crm', 'deal_confirmations', 'crm.deal_confirmations', 'CRM', 'Участок -> День -> Месяц -> Год', 'Подтверждения смен и объёмов'),
    ('crm', 'max_customer_bot_configs', 'crm.max_customer_bot_configs', 'CRM', 'По участку', 'Настройки клиентского бота MAX'),
    ('erp', 'accounting_subjects', 'erp.accounting_subjects', 'ERP / 1С', 'Справочник', 'Субъекты 1С (ООО и ИП) и правила маршрутизации'),
    ('erp', 'contracts', 'erp.contracts', 'ERP / Юрист (общий контур)', 'Единый реестр (фильтр по участку опционален)', 'Общий юридический реестр: договоры, допсоглашения, споры, шаблоны'),
    ('erp', 'legal_disputes', 'erp.legal_disputes', 'ERP / Юрист (общий контур)', 'Единый реестр (фильтр по участку опционален)', 'Споры и претензии с заказчиками'),
    ('erp', 'legal_history', 'erp.legal_history', 'ERP / Юрист', 'Журнал', 'Неизменяемая история действий юриста'),
    ('erp', 'rental_orders', 'erp.rental_orders', 'ERP', 'Участок -> День -> Месяц -> Год', 'Заказы-наряды и оплаты'),
    ('erp', 'cost_allocations_monthly', 'erp.cost_allocations_monthly', 'ERP', 'Участок -> Месяц -> Год', 'Помесячная юнит-экономика техники'),
    ('erp', 'onec_sync_logs', 'erp.onec_sync_logs', 'ERP / 1С', 'Участок -> День -> Месяц -> Год', 'Логи выгрузки в 1С OData/REST'),
    ('erp', 'status_notification_settings', 'erp.status_notification_settings', 'ERP', 'Системный', 'Настройки уведомлений по документам/оплатам'),
    ('erp', 'status_notifications', 'erp.status_notifications', 'ERP', 'Участок -> День -> Месяц -> Год', 'Лента уведомлений статусов'),
    ('forms', 'shift_reports', 'forms.shift_reports', 'Первичные формы', 'Участок -> День -> Месяц -> Год', 'Форма 1 — Сменные рапорты ЭСМ-7 и поток MAX-бота водителя (техника + карта + заказчик)'),
    ('forms', 'waybills', 'forms.waybills', 'Первичные формы', 'Участок -> День -> Месяц -> Год', 'Форма 2 — Путевые листы'),
    ('forms', 'closing_documents', 'forms.closing_documents', 'Первичные формы', 'Участок -> День -> Месяц -> Год', 'Форма 3 — Акт, КС-2 ОКУД 0322005, КС-3 ОКУД 0322001, Счёт'),
    ('forms', 'work_act_items', 'forms.work_act_items', 'Первичные формы', 'Детализация', 'Строки закрывающих документов'),
    ('audit', 'anomaly_alerts', 'audit.anomaly_alerts', 'Аудит ГСМ', 'Участок -> День -> Месяц -> Год', 'Алерты отклонений ГСМ, простоев и долгов'),
    ('audit', 'fuel_audit_logs', 'audit.fuel_audit_logs', 'Аудит ГСМ', 'Участок -> День -> Месяц -> Год', 'Дневные логи отклонений ГСМ'),
    ('rag', 'knowledge_documents', 'rag.knowledge_documents', 'RAG База знаний', 'Справочник', 'Регламенты, нормы ГСМ, шаблоны'),
    ('rag', 'document_chunks', 'rag.document_chunks', 'RAG База знаний', 'Векторный индекс', 'Чанки и эмбеддинги 768d'),
    ('rag', 'retrieval_logs', 'rag.retrieval_logs', 'RAG База знаний', 'Журнал', 'Логи поиска RAG'),
    ('meta', 'users', 'meta.users', 'Администрирование', 'По участку', 'Учётные записи сотрудников'),
    ('meta', 'role_access_policies', 'meta.role_access_policies', 'Администрирование', 'Справочник', 'Матрица RBAC (6 ролей)'),
    ('meta', 'system_admin_config', 'meta.system_admin_config', 'Администрирование', 'Системный', 'Настройки таблиц, LLM, RAG, ГЛОНАСС/ДУТ/CAN'),
    ('meta', 'table_registry', 'meta.table_registry', 'Администрирование', 'Каталог БД', 'Реестр всех таблиц БД');

COMMIT;
