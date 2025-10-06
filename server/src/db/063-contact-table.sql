DO $migration$
DECLARE
    migrationId INT := 63;
    lastSuccessfulMigrationId INT;
BEGIN
    SELECT MAX(id) INTO lastSuccessfulMigrationId FROM migrations;

    IF migrationId - lastSuccessfulMigrationId = 1 THEN

        -- DROP TABLE IF EXISTS contacts;
        -- DROP TABLE IF EXISTS contact_notes;

        -- ===== Create the contacts table =====
        CREATE TABLE contacts (
            contact_id SERIAL PRIMARY KEY,
            contact_name TEXT NOT NULL,
            organization TEXT NOT NULL,
            client_id UUID NOT NULL,
            contact_email TEXT,
            contact_phone_number TEXT,
            tags TEXT[],
            FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
        );

        -- ===== Create the contact_notes table =====
        CREATE TABLE contact_notes (
            note_id SERIAL PRIMARY KEY,
            contact_id INT NOT NULL,
            note TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE CASCADE
        );

        -- ===== Record success =====
        INSERT INTO migrations (id) VALUES (migrationId);

    END IF;
END $migration$;