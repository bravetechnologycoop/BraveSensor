DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 56;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId 
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        
        -- Temporarily disable the trigger to avoid conflicts
        ALTER TABLE public.Clients_new DISABLE TRIGGER add_clients_extension_trigger;

        -- Migrate the data from the existing tables to the new ones
        INSERT INTO public.Clients_new (
            client_id,
            created_at,
            updated_at,
            display_name,
            language,
            responder_phone_numbers,
            fallback_phone_numbers,
            vitals_twilio_number,
            vitals_phone_numbers,
            survey_categories,
            is_displayed,
            devices_sending_alerts,
            devices_sending_vitals,
            devices_status,
            first_device_live_at
        )
        SELECT
            id,
            created_at,
            updated_at,
            display_name,
            language,
            responder_phone_numbers,
            fallback_phone_numbers,
            from_phone_number,
            heartbeat_phone_numbers,
            '{"Overdose Event","Emergency Event","Occupant Okay","Space Empty","Other","I would like to contact Brave"}'::text[],
            is_displayed,
            is_sending_alerts,
            is_sending_vitals,
            CASE
                WHEN status = 'TESTING' THEN 'TESTING'::device_status_enum
                WHEN status = 'SHIPPED' THEN 'SHIPPED'::device_status_enum
                WHEN status = 'LIVE' THEN 'LIVE'::device_status_enum
                ELSE NULL
            END,
            first_device_live_at
        FROM public.Clients; 

        -- Migrate the data from the existing clients_extension table to the new one
        INSERT INTO public.Clients_Extension_new (
            client_id,
            created_at,
            updated_at,
            country,
            country_subdivision,
            building_type,
            city,
            postal_code,
            funder,
            project,
            organization
        )
        SELECT
            client_id,
            created_at,
            updated_at,
            country,
            country_subdivision,
            building_type,
            city,
            postal_code,
            funder,
            project,
            organization
        FROM public.clients_extension;

        -- Re-enable the trigger
        ALTER TABLE public.Clients_new ENABLE TRIGGER add_clients_extension_trigger;

        -- Migrate the data from the existing devices table to the new one
        INSERT INTO public.Devices_new (
            device_id,
            client_id,
            created_at,
            updated_at,
            location_id,
            display_name,
            particle_device_id,
            device_type, 
            device_twilio_number,
            is_displayed,
            is_sending_alerts,
            is_sending_vitals
        ) 
        SELECT 
            id,
            client_id,
            created_at,
            updated_at,
            locationid,
            display_name,
            serial_number,
            CASE
                WHEN device_type = 'SENSOR_SINGLESTALL' THEN 'SENSOR_SINGLESTALL'::device_types_enum
                WHEN device_type = 'SENSOR_MULTISTALL' THEN 'SENSOR_MULTISTALL'::device_types_enum
                ELSE NULL
            END,
            phone_number,
            is_displayed,
            is_sending_alerts,
            is_sending_vitals
        FROM public.devices;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;