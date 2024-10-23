BEGIN;

DO $testdevice$
DECLARE
    client_id UUID;
BEGIN
    -- fetch the client_id from the clients table
    SELECT id INTO client_id
    FROM public.clients
    WHERE display_name = 'TempInitialClient'
    LIMIT 1;

    -- insert a new device using the fetched client_id
    INSERT INTO public.devices (
        locationid,
        phone_number,
        display_name,
        serial_number,
        client_id,
        sent_low_battery_alert_at,
        sent_vitals_alert_at,
        created_at,
        updated_at,
        is_displayed,
        is_sending_alerts,
        is_sending_vitals,
        id,
        device_type
    ) VALUES (
        'TEST_1',                                -- locationid
        '+15555555555',                          -- phone_number
        'Test_1',                                -- display_name
        'e00123456789123456789123',              -- serial_number
        client_id,                               -- dynamically fetched client_id
        NULL,                                    -- sent_low_battery_alert_at
        NULL,                                    -- sent_vitals_alert_at
        NOW(),                                   -- created_at
        NOW(),                                   -- updated_at
        TRUE,                                    -- is_displayed
        TRUE,                                    -- is_sending_alerts
        TRUE,                                    -- is_sending_vitals
        gen_random_uuid(),                       -- id
        'DEVICE_SENSOR'                          -- device_type
    );
END $testdevice$;

-- show inserted test devices before migration 
SELECT * FROM devices;

DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 53;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- create a new enum type
        CREATE TYPE device_type_enum_new AS ENUM ('DEVICE_BUTTON', 'DEVICE_SENSOR_SINGLESTALL', 'DEVICE_SENSOR_MULTISTALL');

        -- add a temporary column with the new enum type
        ALTER TABLE devices ADD COLUMN device_type_new device_type_enum_new;

        -- migrate data to the new column, set existing sensors to singlestall
        UPDATE devices
        SET device_type_new = 
            CASE 
                WHEN device_type = 'DEVICE_SENSOR' THEN 'DEVICE_SENSOR_SINGLESTALL'
                ELSE device_type::text::device_type_enum_new
            END;

        -- drop the old column and rename the new column
        ALTER TABLE devices DROP COLUMN device_type;
        ALTER TABLE devices RENAME COLUMN device_type_new TO device_type;

        -- drop the old enum type and rename the new enum type to the original name 
        DROP TYPE device_type_enum;
        ALTER TYPE device_type_enum_new RENAME TO device_type_enum;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;

-- show all devices after the migration
SELECT * FROM devices;

-- don't commit the transaction, undo this script
ROLLBACK;
