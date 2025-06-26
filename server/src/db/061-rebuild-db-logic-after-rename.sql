DO $migration$
DECLARE
    migrationId INT := 61;
    lastSuccessfulMigrationId INT;
BEGIN
    SELECT MAX(id) INTO lastSuccessfulMigrationId FROM migrations;

    IF migrationId - lastSuccessfulMigrationId = 1 THEN

        -- ===== Drop and redefine trigger functions if needed =====

        -- Drop and recreate: add_clients_extension_trigger_fn
        DROP FUNCTION IF EXISTS add_clients_extension_trigger_fn() CASCADE;

        CREATE OR REPLACE FUNCTION add_clients_extension_trigger_fn()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO clients_extension(client_id) 
            VALUES (NEW.client_id)
            ON CONFLICT (client_id)
            DO NOTHING;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- update_timestamp_trigger_fn and update_vitals_cache_fn assumed still valid
        -- No need to redefine unless logic changes

        -- ===== Drop existing triggers (to clean up any broken ones) =====

        DROP TRIGGER IF EXISTS clients_update_timestamp_trigger ON public.clients;
        DROP TRIGGER IF EXISTS clients_extension_update_timestamp_trigger ON public.clients_extension;
        DROP TRIGGER IF EXISTS devices_update_timestamp_trigger ON public.devices;
        DROP TRIGGER IF EXISTS sessions_update_timestamp_trigger ON public.sessions;
        DROP TRIGGER IF EXISTS add_clients_extension_trigger ON public.clients;
        DROP TRIGGER IF EXISTS update_vitals_cache_trigger ON public.vitals;

        -- ===== Recreate all triggers against the renamed tables =====

        -- Clients table trigger
        CREATE TRIGGER clients_update_timestamp_trigger
        BEFORE UPDATE ON public.clients
        FOR EACH ROW EXECUTE PROCEDURE update_timestamp_trigger_fn();

        -- Clients Extension table trigger
        CREATE TRIGGER clients_extension_update_timestamp_trigger
        BEFORE UPDATE ON public.clients_extension
        FOR EACH ROW EXECUTE PROCEDURE update_timestamp_trigger_fn();

        -- Devices table trigger
        CREATE TRIGGER devices_update_timestamp_trigger
        BEFORE UPDATE ON public.devices
        FOR EACH ROW EXECUTE PROCEDURE update_timestamp_trigger_fn();

        -- Sessions table trigger
        CREATE TRIGGER sessions_update_timestamp_trigger
        BEFORE UPDATE ON public.sessions
        FOR EACH ROW EXECUTE PROCEDURE update_timestamp_trigger_fn();

        -- Insert trigger for clients -> clients_extension
        CREATE TRIGGER add_clients_extension_trigger
        AFTER INSERT ON public.clients
        FOR EACH ROW EXECUTE PROCEDURE add_clients_extension_trigger_fn();

        -- Vitals trigger -> vitals_cache
        CREATE TRIGGER update_vitals_cache_trigger
        AFTER INSERT ON public.vitals
        FOR EACH ROW EXECUTE PROCEDURE update_vitals_cache_fn();
        

        -- ===== Record success =====
        INSERT INTO migrations (id) VALUES (migrationId);
    END IF;
END $migration$;
