SELECT 'branches' as entity, COUNT(*) FROM branch.branches
UNION ALL
SELECT 'users', COUNT(*) FROM meta.users
UNION ALL
SELECT 'equipment', COUNT(*) FROM fleet.equipment
UNION ALL
SELECT 'crm_deals', COUNT(*) FROM crm.deals
UNION ALL
SELECT 'shifts', COUNT(*) FROM forms.shift_reports
UNION ALL
SELECT 'anomalies', COUNT(*) FROM audit.anomaly_alerts;
