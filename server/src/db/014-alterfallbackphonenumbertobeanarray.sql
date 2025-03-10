DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 14;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        ALTER TABLE locations 
            ALTER fallback_phonenumber DROP DEFAULT,
            ALTER fallback_phonenumber TYPE text[] USING array[fallback_phonenumber],
            ALTER fallback_phonenumber SET DEFAULT '{"+17786810411"}';
        ALTER TABLE locations RENAME COLUMN fallback_phonenumber TO fallback_phonenumbers;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
