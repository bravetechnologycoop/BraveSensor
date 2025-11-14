DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 63;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN

        -- Ensure pgcrypto extension for gen_random_uuid()
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        -- Create Contacts_new table (fields based on frontend)
        CREATE TABLE IF NOT EXISTS contacts (
            contact_id      UUID            NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            name            TEXT            NOT NULL,
            organization    TEXT            NOT NULL,
            client_id       UUID            REFERENCES clients(client_id) ON DELETE SET NULL,
            email           VARCHAR(320),
            phone_number    TEXT,
            notes           TEXT,
            shipping_address TEXT,
            last_touchpoint TIMESTAMPTZ,
            shipping_date   DATE,
            tags            TEXT[]          NOT NULL DEFAULT '{}'::text[],
            created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
        );

        -- Indexes for common lookups
        CREATE INDEX IF NOT EXISTS idx_contacts_new_client_id ON public.contacts (client_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_new_name ON public.contacts (name);
        CREATE INDEX IF NOT EXISTS idx_contacts_new_email ON public.contacts (email);

        -- Attach update timestamp trigger (update_timestamp_trigger_fn created in earlier redesign migrations)
        CREATE TRIGGER contacts_update_timestamp_trigger
        BEFORE UPDATE ON public.contacts
        FOR EACH ROW EXECUTE PROCEDURE update_timestamp_trigger_fn();

        -- Record successful migration
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;