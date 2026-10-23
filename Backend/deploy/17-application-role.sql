\set ON_ERROR_STOP on

SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
    :'app_role',
    :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

ALTER ROLE :"app_role"
    LOGIN PASSWORD :'app_password'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

SELECT set_config('kudiba.owner_role', :'owner_role', false);
SELECT set_config('kudiba.app_role', :'app_role', false);

DO $$
DECLARE
    owner_oid oid := (SELECT oid FROM pg_roles WHERE rolname = current_setting('kudiba.owner_role'));
    app_role text := current_setting('kudiba.app_role');
    schema_record record;
    object_record record;
BEGIN
    FOR schema_record IN
        SELECT nspname
        FROM pg_namespace
        WHERE nspowner = owner_oid
          AND nspname LIKE 'kudiba\_%' ESCAPE '\'
    LOOP
        EXECUTE format('ALTER SCHEMA %I OWNER TO %I', schema_record.nspname, app_role);

        FOR object_record IN
            SELECT c.relname, c.relkind
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = schema_record.nspname
              AND c.relowner = owner_oid
              AND c.relkind IN ('r', 'p', 'f', 'v', 'm', 'S')
        LOOP
            CASE object_record.relkind
                WHEN 'v' THEN
                    EXECUTE format(
                        'ALTER VIEW %I.%I OWNER TO %I',
                        schema_record.nspname, object_record.relname, app_role
                    );
                WHEN 'm' THEN
                    EXECUTE format(
                        'ALTER MATERIALIZED VIEW %I.%I OWNER TO %I',
                        schema_record.nspname, object_record.relname, app_role
                    );
                WHEN 'S' THEN
                    EXECUTE format(
                        'ALTER SEQUENCE %I.%I OWNER TO %I',
                        schema_record.nspname, object_record.relname, app_role
                    );
                ELSE
                    EXECUTE format(
                        'ALTER TABLE %I.%I OWNER TO %I',
                        schema_record.nspname, object_record.relname, app_role
                    );
            END CASE;
        END LOOP;

        FOR object_record IN
            SELECT t.typname
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = schema_record.nspname
              AND t.typowner = owner_oid
              AND t.typrelid = 0
              AND t.typtype IN ('d', 'e', 'r')
        LOOP
            EXECUTE format(
                'ALTER TYPE %I.%I OWNER TO %I',
                schema_record.nspname, object_record.typname, app_role
            );
        END LOOP;

        FOR object_record IN
            SELECT p.proname, p.prokind, pg_get_function_identity_arguments(p.oid) AS arguments
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = schema_record.nspname
              AND p.proowner = owner_oid
        LOOP
            IF object_record.prokind = 'p' THEN
                EXECUTE format(
                    'ALTER PROCEDURE %I.%I(%s) OWNER TO %I',
                    schema_record.nspname, object_record.proname, object_record.arguments, app_role
                );
            ELSIF object_record.prokind = 'f' THEN
                EXECUTE format(
                    'ALTER FUNCTION %I.%I(%s) OWNER TO %I',
                    schema_record.nspname, object_record.proname, object_record.arguments, app_role
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;

SELECT format('GRANT CONNECT, CREATE ON DATABASE %I TO %I', current_database(), :'app_role')
\gexec
