DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 44;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Disable the set_sessions_timestamp trigger so updated_at doesn't change
        ALTER TABLE sessions
        DISABLE TRIGGER set_sessions_timestamp;

        -- Add the number_of_alerts column to the sessions table
        -- NOTE: the default value will be used for all previous sessions
        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS number_of_alerts INT NOT NULL DEFAULT 1;

        -- Enable the set_sessions_timestamp trigger now that the above queries have completed
        ALTER TABLE sessions
        ENABLE TRIGGER set_sessions_timestamp;

        -- Add 'RESET' to the chatbot state enum
        ALTER TYPE chatbot_state_enum
        ADD VALUE IF NOT EXISTS 'RESET';

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
