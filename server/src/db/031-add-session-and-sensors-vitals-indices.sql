DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 31;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        CREATE INDEX IF NOT EXISTS sessions_locationid_idx ON sessions (locationid);

        CREATE INDEX IF NOT EXISTS sensors_vitals_locationid_idx ON sensors_vitals (locationid);

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;