DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 40;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE

        -- Remove default values
        ALTER TABLE locations
        ALTER COLUMN movement_threshold
        DROP DEFAULT;

        ALTER TABLE locations
        ALTER COLUMN initial_timer
        DROP DEFAULT;

        ALTER TABLE locations
        ALTER COLUMN duration_timer
        DROP DEFAULT;

        ALTER TABLE locations
        ALTER COLUMN stillness_timer
        DROP DEFAULT;

        ALTER TABLE locations
        ALTER COLUMN display_name
        DROP DEFAULT;

        -- Convert to integers
        ALTER TABLE locations
        ALTER COLUMN movement_threshold TYPE INTEGER USING (movement_threshold::integer);

        ALTER TABLE locations
        ALTER COLUMN initial_timer TYPE INTEGER USING (initial_timer::integer);

        ALTER TABLE locations
        ALTER COLUMN duration_timer TYPE INTEGER USING (duration_timer::integer);

        ALTER TABLE locations
        ALTER COLUMN stillness_timer TYPE INTEGER USING (stillness_timer::integer);

        -- Add new default values
        ALTER TABLE locations
        ALTER COLUMN movement_threshold
        SET DEFAULT 60;

        ALTER TABLE locations
        ALTER COLUMN initial_timer
        SET DEFAULT 15;

        ALTER TABLE locations
        ALTER COLUMN duration_timer
        SET DEFAULT 900;

        ALTER TABLE locations
        ALTER COLUMN stillness_timer
        SET DEFAULT 60;

        -- Do not allow null
        ALTER TABLE locations
        ALTER COLUMN movement_threshold
        SET NOT NULL;

        ALTER TABLE locations
        ALTER COLUMN initial_timer
        SET NOT NULL;

        ALTER TABLE locations
        ALTER COLUMN duration_timer
        SET NOT NULL;

        ALTER TABLE locations
        ALTER COLUMN stillness_timer
        SET NOT NULL;

        ALTER TABLE locations
        ALTER COLUMN display_name
        SET NOT NULL;

        ALTER TABLE locations
        ALTER COLUMN is_active
        SET NOT NULL;

        -- Add column for the door ID
        ALTER TABLE locations
        ADD COLUMN IF NOT EXISTS door_id TEXT;
        
        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
