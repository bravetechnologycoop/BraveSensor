DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 13;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        ALTER TABLE locations DROP COLUMN deviceid;
        ALTER TABLE locations DROP COLUMN detectionzone_min;
        ALTER TABLE locations DROP COLUMN detectionzone_max;
        ALTER TABLE locations RENAME COLUMN unresponded_timer TO reminder_timer;
        ALTER TABLE locations RENAME COLUMN unresponded_session_timer TO fallback_timer;
        ALTER TABLE locations ADD PRIMARY KEY locationid;
        ALTER TABLE locations ADD UNIQUE (locationid);

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;