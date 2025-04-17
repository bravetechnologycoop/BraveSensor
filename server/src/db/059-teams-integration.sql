DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 59;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId 
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        
        -- Add Teams-related columns to Clients_new
        ALTER TABLE Clients_new
        ADD COLUMN teams_id TEXT,
        ADD COLUMN teams_alert_channel_id TEXT,
        ADD COLUMN teams_vital_channel_id TEXT;
        
        -- Create new enum for session responded via
        CREATE TYPE session_responded_via_enum AS ENUM ('TWILIO', 'TEAMS');

        -- Add session_responded_via column to Sessions_new
        ALTER TABLE Sessions_new
        ADD COLUMN session_responded_via session_responded_via_enum;

        -- Create Teams Events table
        CREATE TABLE IF NOT EXISTS Teams_Events_new (
            event_id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            session_id              UUID        NOT NULL REFERENCES Sessions_new(session_id) ON DELETE CASCADE,
            event_type              TEXT        NOT NULL,
            event_type_details      TEXT,
            event_sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            message_id              TEXT        NOT NULL
        );

        -- Add indices
        CREATE INDEX idx_teams_events_new_session_id ON Teams_Events_new(session_id);
        CREATE INDEX idx_teams_events_new_event_type ON Teams_Events_new(event_type);
        CREATE INDEX idx_teams_events_new_sent_at ON Teams_Events_new(event_sent_at DESC);

        -- Update the migration ID
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;