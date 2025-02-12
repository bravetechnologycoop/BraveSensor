DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 23;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Add new columns
        ALTER TABLE clients ADD COLUMN responder_phone_number TEXT;
        ALTER TABLE clients ADD COLUMN alert_api_key TEXT;
        ALTER TABLE clients ADD COLUMN responder_push_id TEXT;

        -- Set columns in clients based on their values in locations
        UPDATE clients
        SET 
            responder_phone_number = locations.responder_phone_number,
            alert_api_key = locations.alert_api_key
        FROM locations
        WHERE clients.id = locations.client_id;

        -- Remove the columns from locations
        ALTER TABLE locations DROP COLUMN responder_phone_number;
        ALTER TABLE locations DROP COLUMN alert_api_key;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;