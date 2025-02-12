DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 28;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Add missing columns to better match the combined schema
        ALTER TABLE clients
        ADD COLUMN fallback_phone_numbers TEXT[] NOT NULL DEFAULT '{}';

        ALTER TABLE clients
        ADD COLUMN incident_categories TEXT[] NOT NULL DEFAULT '{}';

        ALTER TABLE clients
        ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT false;

        ALTER TABLE clients
        ADD COLUMN reminder_timeout INTEGER NOT NULL DEFAULT 120;

        ALTER TABLE clients
        ADD COLUMN fallback_timeout INTEGER NOT NULL DEFAULT 240;

        ALTER TABLE clients
        ADD COLUMN heartbeat_phone_numbers TEXT[] NOT NULL DEFAULT '{}';

        -- All sensors have the same set of incident categories right now
        UPDATE clients
        SET incident_categories = '{"No One Inside","Person responded","Overdose","None of the above"}';

        -- Set all clients as active because right, whether it's active or not is determined at the location-level
        UPDATE clients
        SET is_active = 't';

        -- Copy heartbeat_alert_recipients from locations and remove column from locations.
        -- Assumes that all the locations from the same client will have the same value for heartbeat_alert_recipients
        UPDATE clients
        SET heartbeat_phone_numbers = COALESCE((
            SELECT heartbeat_alert_recipients
            FROM locations
            WHERE clients.id = locations.client_id
            LIMIT 1
        ), '{}');

        ALTER TABLE locations
        DROP COLUMN heartbeat_alert_recipients;

        -- Copy fallback_phonenumbers from locations and remove column from locations.
        -- Assumes that all the locations from the same client will have the same value for fallback_phonenumbers
        UPDATE clients
        SET fallback_phone_numbers = COALESCE((
            SELECT fallback_phonenumbers
            FROM locations
            WHERE clients.id = locations.client_id
            LIMIT 1
        ), '{}');

        ALTER TABLE locations
        DROP COLUMN fallback_phonenumbers;

        -- Copy reminder_time from locations and remove column from locations.
        -- Assumes that all the locations from the same client will have the same value for reminder_time
        UPDATE clients
        SET reminder_timeout = COALESCE((
            SELECT reminder_timer / 1000
            FROM locations
            WHERE clients.id = locations.client_id
            LIMIT 1
        ), 120);

        ALTER TABLE locations
        DROP COLUMN reminder_timer;

        -- Copy fallback_timer from locations and remove column from locations.
        -- Assumes that all the locations from the same client will have the same value for fallback_timer
        UPDATE clients
        SET fallback_timeout = COALESCE((
            SELECT fallback_timer / 1000
            FROM locations
            WHERE clients.id = locations.client_id
            LIMIT 1
        ), 240);

        ALTER TABLE locations
        DROP COLUMN fallback_timer;

        -- Change initial_timer default from being expressed in milliseconds to seconds
        -- To reduce incorrect location initialization
        ALTER TABLE locations
        ALTER COLUMN initial_timer
        SET DEFAULT '15';

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;