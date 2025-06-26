DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 60;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN

        -- Backup old tables by renaming
        ALTER TABLE IF EXISTS public.clients RENAME TO clients_old;
        ALTER TABLE IF EXISTS public.clients_extension RENAME TO clients_extension_old;
        ALTER TABLE IF EXISTS public.devices RENAME TO devices_old;
        ALTER TABLE IF EXISTS public.sessions RENAME TO sessions_old;
        ALTER TABLE IF EXISTS public.sensors_vitals RENAME TO sensors_vitals_old;
        ALTER TABLE IF EXISTS public.sensors_vitals_cache RENAME TO sensors_vitals_cache_old;

        -- Rename _new tables to original names
        ALTER TABLE IF EXISTS public.clients_new RENAME TO clients;
        ALTER TABLE IF EXISTS public.clients_extension_new RENAME TO clients_extension;
        ALTER TABLE IF EXISTS public.devices_new RENAME TO devices;
        ALTER TABLE IF EXISTS public.sessions_new RENAME TO sessions;
        ALTER TABLE IF EXISTS public.events_new RENAME TO events;
        ALTER TABLE IF EXISTS public.notifications_new RENAME TO notifications;
        ALTER TABLE IF EXISTS public.vitals_cache_new RENAME TO vitals_cache;
        ALTER TABLE IF EXISTS public.vitals_new RENAME TO vitals;
        ALTER TABLE IF EXISTS public.teams_events_new RENAME TO teams_events;


        -- Update the migration ID
        INSERT INTO migrations (id) VALUES (migrationId);
    END IF;
END $migration$;