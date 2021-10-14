DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 26;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Add column to store the timestamp of the last time a vitals alert was sent
        ALTER TABLE locations
        ADD COLUMN sent_vitals_alert_at timestamptz;
 
        -- For all locations that already have a sent alert, set this new column value to NOW()
        -- because we don't have any better guesses as to when the alert was actually sent
        UPDATE locations
        SET sent_vitals_alert_at = now()
        WHERE heartbeat_sent_alerts IS true;
 
        -- Delete the old column
        ALTER TABLE locations
        DROP COLUMN heartbeat_sent_alerts;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;