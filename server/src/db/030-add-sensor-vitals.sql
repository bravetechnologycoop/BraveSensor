DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 30;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        CREATE TABLE IF NOT EXISTS sensors_vitals (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            locationid TEXT REFERENCES locations (locationid) NOT NULL,
            missed_door_messages INTEGER NOT NULL,
            is_door_battery_low BOOLEAN NOT NULL,
            door_last_seen_at timestamptz NOT NULL,
            reset_reason TEXT NOT NULL,
            state_transitions TEXT[] NOT NULL,
            created_at timestamptz NOT NULL DEFAULT NOW()
        );

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;