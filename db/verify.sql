SELECT schemaname, COUNT(*) as tables 
FROM pg_tables 
WHERE schemaname NOT LIKE 'pg%%' AND schemaname != 'information_schema' 
GROUP BY schemaname 
ORDER BY schemaname;
