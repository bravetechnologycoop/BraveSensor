DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 21;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE

        -- Create a minimal clients table for the from_phone_number
        CREATE TABLE IF NOT EXISTS clients (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            display_name text NOT NULL UNIQUE,
            from_phone_number text NOT NULL,
            created_at timestamptz NOT NULL default now(),
            updated_at timestamptz NOT NULL default now()
        );

        -- Add a trigger to update the clients.updated_at column
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $t$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;

        CREATE TRIGGER set_clients_timestamp
        BEFORE UPDATE ON clients
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        -- Insert an initial client with the Canadian From Number so that this table won't be empty and so that it will work immediately. This will need to be updated manually to have a row for each client
        INSERT INTO clients (display_name, from_phone_number)
        VALUES ('TempInitialClient', '+16048007157');

        -- Add the many-locations to one-client relationship
        ALTER TABLE locations
        ADD COLUMN client_id uuid REFERENCES clients (id);

        -- Set all locations to have the same initial client
        UPDATE locations
        SET client_id = (
            SELECT id
            FROM clients
        );

        -- Do not allow a location's client_id to be null
        ALTER TABLE locations
        ALTER COLUMN client_id
        SET NOT NULL;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;