DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 65;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Tracks per-message Twilio delivery status so we can surface when an SMS was actually
        -- delivered to the handset (received_at), not just when we handed it to Twilio
        -- (events.event_sent_at). One row per Twilio message SID; populated at send time and
        -- updated by the /twilio/status delivery callback.
        CREATE TABLE IF NOT EXISTS message_deliveries (
            delivery_id     UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            event_id        UUID        REFERENCES events(event_id) ON DELETE CASCADE,
            twilio_sid      TEXT        NOT NULL UNIQUE,
            to_number       TEXT,
            from_number     TEXT,
            message_key     TEXT,
            status          TEXT,
            error_code      TEXT,
            sent_at         TIMESTAMPTZ,
            received_at     TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX idx_message_deliveries_event_id ON message_deliveries(event_id);
        CREATE INDEX idx_message_deliveries_received_at ON message_deliveries(received_at DESC);

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
