DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 34;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Disable the trigger so that `updated_at` will stay the same
        ALTER TABLE sessions
        DISABLE TRIGGER set_sessions_timestamp;

        -- `state` column hasn't been used since the state was moved to Redis
        ALTER TABLE sessions
        DROP COLUMN IF EXISTS state;

        -- We haven't used notes in Sensors since Jan 2020. This is legacy from Buttons.
        ALTER TABLE sessions
        DROP COLUMN IF EXISTS notes;

        -- Doesn't appear to be used anymore. Instead it looks up using locations.twilio_number
        ALTER TABLE sessions
        DROP COLUMN IF EXISTS phone_number;

        -- Change name to match shared schema and clients.incident_categories
        ALTER TABLE sessions
        RENAME COLUMN incident_type TO incident_category;

        -- Add foreign key reference between sessions and locations
        ALTER TABLE sessions
        ADD CONSTRAINT sessions_locationid_fkey FOREIGN KEY (locationid) REFERENCES locations (locationid);

        -- Do not allow sessions.locationid to be NULL
        ALTER TABLE sessions
        ALTER COLUMN locationid
        SET NOT NULL;

        -- Use enums for CHATBOT_STATE
        CREATE TYPE chatbot_state_enum AS ENUM ('STARTED', 'WAITING_FOR_REPLY', 'RESPONDING', 'WAITING_FOR_CATEGORY', 'COMPLETED');

        ALTER TABLE sessions
        RENAME COLUMN chatbot_state TO chatbot_state_text;

        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS chatbot_state chatbot_state_enum;

        UPDATE sessions
        SET chatbot_state = 'STARTED'
        WHERE chatbot_state_text = 'Started';

        UPDATE sessions
        SET chatbot_state = 'WAITING_FOR_REPLY'
        WHERE chatbot_state_text = 'Waiting for reply';

        UPDATE sessions
        SET chatbot_state = 'RESPONDING'
        WHERE chatbot_state_text = 'Responding';

        UPDATE sessions
        SET chatbot_state = 'WAITING_FOR_CATEGORY'
        WHERE chatbot_state_text IN ('Waiting for incident category', 'Waiting for Category');

        UPDATE sessions
        SET chatbot_state = 'COMPLETED'
        WHERE chatbot_state_text = 'Completed';

        UPDATE sessions
        SET chatbot_state = 'COMPLETED'
        WHERE chatbot_state_text = 'Waiting for Details'; -- This is left over from when we were collecting notes/details. The last one of these in the DB was created in Jan 2020

        UPDATE sessions
        SET chatbot_state = 'WAITING_FOR_REPLY'
        WHERE chatbot_state_text IS NULL; -- This is left over from when we were tracking non-alerting sessions. The last one of these in the DB was created in Apr 2021

        ALTER TABLE sessions
        DROP COLUMN IF EXISTS chatbot_state_text;

        ALTER TABLE sessions
        ALTER COLUMN chatbot_state
        SET NOT NULL;

        -- Re-enable the trigger so `updated_at` is updated once
        ALTER TABLE sessions
        ENABLE TRIGGER set_sessions_timestamp;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;