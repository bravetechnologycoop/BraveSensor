DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 32;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Create a new sensors_vitals_cache table with the same columns as sensors_vitals plus an updated_at column
        CREATE TABLE IF NOT EXISTS sensors_vitals_cache (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            locationid TEXT REFERENCES locations (locationid) UNIQUE NOT NULL,
            missed_door_messages INTEGER NOT NULL,
            is_door_battery_low BOOLEAN NOT NULL,
            door_last_seen_at timestamptz NOT NULL,
            reset_reason TEXT NOT NULL,
            state_transitions TEXT[] NOT NULL,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW()
        );

        -- Add the foreign key index onto new sensors_vitals_cache table
        CREATE INDEX IF NOT EXISTS sensors_vitals_cache_locationid_idx ON sensors_vitals_cache (locationid);

        -- Add a trigger to update the sensors_vitals_cache.updated_at column
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $t$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;

        CREATE TRIGGER set_sensors_vitals_cache_timestamp
        BEFORE UPDATE ON sensors_vitals_cache
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        -- Insert the most recent vitals for each location into the new sensors_vitals_cache table
        INSERT INTO sensors_vitals_cache
        SELECT a.*
        FROM (
            SELECT DISTINCT ON (l.display_name) sv.*
            FROM sensors_vitals AS sv
            LEFT JOIN locations AS l ON l.locationid = sv.locationid
            ORDER BY l.display_name, sv.created_at DESC
        ) AS a;

        -- Add trigger to insert or update sensors_vitals_cache every time a new row is added to sensors_vitals
        CREATE OR REPLACE FUNCTION create_sensors_vitals_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO sensors_vitals_cache (id, locationid, missed_door_messages, is_door_battery_low, door_last_seen_at, reset_reason, state_transitions, created_at) 
            VALUES (NEW.id, NEW.locationid, NEW.missed_door_messages, NEW.is_door_battery_low, NEW.door_last_seen_at, NEW.reset_reason, NEW.state_transitions, NEW.created_at)
            ON CONFLICT (locationid)
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

        CREATE TRIGGER create_sensors_vitals_trigger
        BEFORE INSERT OR UPDATE ON sensors_vitals
        FOR EACH ROW EXECUTE PROCEDURE create_sensors_vitals_trigger_fn();

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;