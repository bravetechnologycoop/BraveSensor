DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 16;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        ALTER TABLE locations 
            ALTER heartbeat_alert_recipient DROP DEFAULT,
            ALTER heartbeat_alert_recipient TYPE text[] USING array[heartbeat_alert_recipient],
            ALTER heartbeat_alert_recipient SET DEFAULT '{"+17786810411"}';
        ALTER TABLE locations RENAME COLUMN heartbeat_alert_recipient TO heartbeat_alert_recipients;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;