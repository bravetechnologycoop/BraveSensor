DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 3;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN


        ALTER TABLE locations ALTER COLUMN detectionzone_min SET DEFAULT '0.4';
        ALTER TABLE locations ALTER COLUMN detectionzone_max SET DEFAULT '3';
        ALTER TABLE locations ALTER COLUMN sensitivity SET DEFAULT '2';
        ALTER TABLE locations ALTER COLUMN led SET DEFAULT '0';
        ALTER TABLE locations ALTER COLUMN noisemap SET DEFAULT '2';
        ALTER TABLE locations ALTER COLUMN mov_threshold SET DEFAULT '17';
        ALTER TABLE locations ALTER COLUMN duration_threshold SET DEFAULT '900';
        ALTER TABLE locations ALTER COLUMN still_threshold SET DEFAULT '60';
        ALTER TABLE locations ALTER COLUMN rpm_threshold SET DEFAULT '8';
        ALTER TABLE locations ALTER COLUMN xethru_heartbeat_number SET DEFAULT '+17786810411';


        ALTER TABLE locations ADD COLUMN unresponded_timer integer default 30000; 
        ALTER TABLE locations ADD COLUMN auto_reset_threshold integer default 1320000; 
        ALTER TABLE locations ADD COLUMN twilio_number text default '+17787653445'; 
        ALTER TABLE locations ADD COLUMN door_stickiness_delay text default '15000';
        ALTER TABLE locations ADD COLUMN unresponded_session_timer integer default 90000; 



        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;