DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 57;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId 
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        
        -- Add the new column with default value of 180 seconds (3 minutes)
        ALTER TABLE public.Clients_new
        ADD COLUMN stillness_survey_followup_delay INTEGER NOT NULL DEFAULT 180;

        -- Update the migration ID
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;