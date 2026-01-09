DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 64;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Add unique constraint to particle_device_id column in devices table
        -- This ensures no two devices can have the same particle_device_id
        -- and will raise an error on INSERT or UPDATE that would violate this constraint
        ALTER TABLE devices ADD CONSTRAINT devices_particle_device_id_unique UNIQUE (particle_device_id);

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
