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

        -- add, and alter columns
        -- this cascades to sensors_vitals_locationid_fkey on sensors_vitals,
        -- sensors_vitals_cache_locationid_fkey on sensors_vitals_cache,
        -- and sessions_locationid_fkey on sessions.
        ALTER TABLE locations DROP CONSTRAINT locations_pkey CASCADE;
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

        -- disable the create_sensors_vitals_trigger trigger
        ALTER TABLE sensors_vitals DISABLE TRIGGER create_sensors_vitals_trigger;

        ALTER TABLE sensors_vitals ALTER COLUMN locationid DROP NOT NULL;
        ALTER TABLE sensors_vitals ADD COLUMN device_id uuid NOT NULL;

        -- update constraints and indexes
        ALTER TABLE sensors_vitals ADD CONSTRAINT sensors_vitals_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id);
        CREATE INDEX sensors_vitals_device_id_key ON sensors_vitals (device_id);

        -- update trigger function
        CREATE OR REPLACE FUNCTION create_sensors_vitals_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO sensors_vitals_cache (id, device_id, missed_door_messages, is_door_battery_low, door_last_seen_at, reset_reason, state_transitions, created_at) 
            VALUES (NEW.id, NEW.device_id, NEW.missed_door_messages, NEW.is_door_battery_low, NEW.door_last_seen_at, NEW.reset_reason, NEW.state_transitions, NEW.created_at)
            ON CONFLICT (device_id)
            DO UPDATE SET
                id = NEW.id,
                missed_door_messages = NEW.missed_door_messages,
                is_door_battery_low = NEW.is_door_battery_low,
                door_last_seen_at = NEW.door_last_seen_at,
                reset_reason = NEW.reset_reason,
                state_transitions = NEW.state_transitions,
                created_at = NEW.created_at;
            RETURN NEW;
        END;
        $t$;

        ALTER TABLE sensors_vitals ENABLE TRIGGER create_sensors_vitals_trigger;

        -- sensors_vitals_cache table changes

        ALTER TABLE sensors_vitals_cache DISABLE TRIGGER set_sensors_vitals_cache_timestamp;

        -- add, and alter columns
        ALTER TABLE sensors_vitals_cache ADD COLUMN device_id uuid NOT NULL;
        ALTER TABLE sensors_vitals_cache ALTER COLUMN locationid DROP NOT NULL;

        -- indexes, constraints, and triggers
        ALTER TABLE sensors_vitals_cache ADD CONSTRAINT sensors_vitals_cache_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id);
        ALTER TABLE sensors_vitals_cache DROP CONSTRAINT sensors_vitals_cache_locationid_key;
        CREATE INDEX sensors_vitals_cache_device_id_key ON sensors_vitals_cache (device_id);

        ALTER TABLE sensors_vitals_cache ENABLE TRIGGER set_sensors_vitals_cache_timestamp;

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
