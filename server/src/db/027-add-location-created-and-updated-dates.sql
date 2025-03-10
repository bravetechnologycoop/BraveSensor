DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 27;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Add missing created_at column
        ALTER TABLE locations
        ADD COLUMN created_at timestamptz NOT NULL DEFAULT NOW();

        -- Add missing updated_at column
        ALTER TABLE locations
        ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW();

        -- Add a trigger to update the locations.updated_at column
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $t$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;

        CREATE TRIGGER set_locations_timestamp
        BEFORE UPDATE ON locations
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;