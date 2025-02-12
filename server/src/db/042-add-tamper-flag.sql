DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 42;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE

        -- Don't update the sensors_vitals_cache
        DROP TRIGGER IF EXISTS create_sensors_vitals_trigger ON sensors_vitals;

        -- Add is_tampered column to sensors_vitals, set it to FALSE, and then make it not nullable
        ALTER TABLE sensors_vitals
        ADD COLUMN IF NOT EXISTS is_tampered BOOLEAN;

        UPDATE sensors_vitals
        SET is_tampered = 'f';

        ALTER TABLE sensors_vitals
        ALTER COLUMN is_tampered
        SET NOT NULL;

        -- Add is_tampered column to sensors_vitals_cache, set it to FALSE, and then make it not nullable
        ALTER TABLE sensors_vitals_cache
        ADD COLUMN IF NOT EXISTS is_tampered BOOLEAN;

        UPDATE sensors_vitals_cache
        SET is_tampered = 'f';

        ALTER TABLE sensors_vitals_cache
        ALTER COLUMN is_tampered
        SET NOT NULL;

        -- Re-activate trigger with new is_tampered column
        CREATE OR REPLACE FUNCTION create_sensors_vitals_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO sensors_vitals_cache (id, locationid, missed_door_messages, is_door_battery_low, door_last_seen_at, reset_reason, state_transitions, created_at, is_tampered) 
            VALUES (NEW.id, NEW.locationid, NEW.missed_door_messages, NEW.is_door_battery_low, NEW.door_last_seen_at, NEW.reset_reason, NEW.state_transitions, NEW.created_at, NEW.is_tampered)
            ON CONFLICT (locationid)
            DO UPDATE SET
                id = NEW.id,
                missed_door_messages = NEW.missed_door_messages,
                is_door_battery_low = NEW.is_door_battery_low,
                door_last_seen_at = NEW.door_last_seen_at,
                reset_reason = NEW.reset_reason,
                state_transitions = NEW.state_transitions,
                created_at = NEW.created_at,
                is_tampered = NEW.is_tampered;
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