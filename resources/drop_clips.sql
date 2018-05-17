COPY (SELECT 'DROP VIEW ' ||n.nspname ||'.'|| c.relname||';' AS command
FROM pg_catalog.pg_class AS c
LEFT JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'clips') TO '/tmp/drop_clips_views.sql';