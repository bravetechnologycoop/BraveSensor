DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 46;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        CREATE TYPE device_type_enum AS ENUM ('DEVICE_BUTTON', 'DEVICE_SENSOR');

        -- locations table changes

        ALTER TABLE locations DISABLE TRIGGER set_locations_timestamp;

        -- drop these constraints so we can drop locationid as primary key
        ALTER TABLE sensors_vitals_cache DROP CONSTRAINT sensors_vitals_cache_locationid_fkey;
        ALTER TABLE sensors_vitals DROP CONSTRAINT sensors_vitals_locationid_fkey;

        -- add, and alter columns
        ALTER TABLE locations DROP CONSTRAINT locations_pkey;
        ALTER TABLE locations ALTER COLUMN locationid DROP NOT NULL;
        ALTER TABLE locations ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
        ALTER TABLE locations ADD COLUMN device_type device_type_enum NOT NULL DEFAULT 'DEVICE_SENSOR';
        -- ~ all rows in locations now have device_type = 'DEVICE_SENSOR'
        ALTER TABLE locations ALTER COLUMN device_type DROP DEFAULT;
        ALTER TABLE locations RENAME COLUMN radar_particlecoreid TO serial_number;

        -- drop some columns
        ALTER TABLE locations DROP COLUMN movement_threshold;
        ALTER TABLE locations DROP COLUMN duration_timer;
        ALTER TABLE locations DROP COLUMN stillness_timer;
        ALTER TABLE locations DROP COLUMN initial_timer;
        ALTER TABLE locations DROP COLUMN door_id;
        ALTER TABLE locations DROP COLUMN is_in_debug_mode;

        -- rename locations table to devices
        ALTER TABLE locations RENAME TO devices;

        -- indexes, constraints, and triggers
        ALTER TABLE devices ADD PRIMARY KEY (id); -- id is the new primary key
        ALTER TABLE devices RENAME CONSTRAINT locations_client_id_fkey TO devices_client_id_fkey;
        ALTER TRIGGER set_locations_timestamp ON devices RENAME TO set_devices_timestamp;

        -- enable set devices timestamp trigger
        ALTER TABLE devices ENABLE TRIGGER set_devices_timestamp;

        -- sensors_vitals table changes

        ALTER TABLE sensors_vitals ADD CONSTRAINT sensors_vitals_locationid_fkey FOREIGN KEY (locationid) REFERENCES devices (locationid);

        -- sensors_vitals_cache table changes

        ALTER TABLE sensors_vitals_cache ADD CONSTRAINT sensors_vitals_cache_locationid_fkey FOREIGN KEY (locationid) REFERENCES devices (locationid);

        -- sessions table changes

        ALTER TABLE sessions DISABLE TRIGGER set_sessions_timestamp;

        ALTER TABLE sessions ADD COLUMN device_id uuid;
        UPDATE sessions SET device_id = devices.id FROM devices WHERE sessions.locationid = devices.locationid;
        ALTER TABLE sessions ALTER COLUMN device_id SET NOT NULL;
        ALTER TABLE sessions ADD CONSTRAINT sessions_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id);

        ALTER TABLE sessions DROP COLUMN locationid; -- not necessary anymore

        ALTER TABLE sessions ENABLE TRIGGER set_sessions_timestamp;

        -- notifications table changes

        DROP TABLE IF EXISTS notifications;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
