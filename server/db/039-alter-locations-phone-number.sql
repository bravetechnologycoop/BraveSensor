DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 39;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Rename column
        ALTER TABLE locations
        RENAME COLUMN twilio_number TO phone_number;

        -- Don't allow nulls
        ALTER TABLE locations
        ALTER COLUMN phone_number
        SET NOT NULL;
        
        -- Remove default values
        ALTER TABLE locations
        ALTER COLUMN phone_number
        DROP DEFAULT;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
