-- Table creation
DO $create_tables$
BEGIN
    -- Create Enum Types for status and event types
    CREATE TYPE device_status_enum AS ENUM ('TESTING', 'SHIPPED', 'LIVE');
    CREATE TYPE device_types_enum AS ENUM ('SENSOR_SINGLESTALL', 'SENSOR_MULTISTALL');
    CREATE TYPE session_status_enum AS ENUM ('ACTIVE', 'COMPLETED', 'SUSPENDED');
    CREATE TYPE event_type_enum AS ENUM ('DURATION_ALERT', 'STILLNESS_ALERT', 'DOOR_OPENED', 'MSG_SENT', 'CALL', 'MSG_RECEIVED');
    CREATE TYPE vital_type_enum AS ENUM ('LOW_BATTERY', 'SENSOR_DISCONNECTED', 'SENSOR_RECONNECTED', 'DOOR_DISCONNECTED', 'DOOR_RECONNECTED');

    -- Create the Clients_new table
    CREATE TABLE Clients_new (
        client_id                   UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        display_name                TEXT                NOT NULL UNIQUE,
        language                    TEXT                NOT NULL DEFAULT 'en',
        created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
        responder_phone_numbers     TEXT[]              NOT NULL DEFAULT '{}'::text[],
        fallback_phone_numbers      TEXT[]              NOT NULL DEFAULT '{}'::text[],
        vitals_twilio_number        TEXT                NOT NULL,
        vitals_phone_numbers        TEXT[]              NOT NULL DEFAULT '{}'::text[],
        survey_categories           TEXT[]              NOT NULL DEFAULT '{"Overdose Event","Emergency Event","Occupant Okay","Space Empty","Other","I would like to contact Brave"}'::text[], 
        is_displayed                BOOLEAN             NOT NULL,
        devices_sending_alerts      BOOLEAN             NOT NULL,
        devices_sending_vitals      BOOLEAN             NOT NULL,
        devices_status              device_status_enum  NOT NULL DEFAULT 'LIVE',
        first_device_live_at        DATE
    );

    -- Create the Clients_Extension_new table
    CREATE TABLE Clients_Extension_new (
        client_id                   UUID                NOT NULL PRIMARY KEY REFERENCES Clients_new(client_id) ON DELETE CASCADE,
        created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
        country                     TEXT,
        country_subdivision         TEXT,
        building_type               TEXT,
        city                        TEXT,
        postal_code                 TEXT,
        funder                      TEXT,
        project                     TEXT,
        organization                TEXT
    );

    -- Create the Devices_new table
    CREATE TABLE Devices_new (
        device_id                   UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        location_id                 TEXT                NOT NULL,
        display_name                TEXT                NOT NULL,
        client_id                   UUID                NOT NULL REFERENCES Clients_new(client_id) ON DELETE CASCADE,
        created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
        particle_device_id          TEXT                NOT NULL,
        device_type                 device_types_enum   NOT NULL DEFAULT 'SENSOR_SINGLESTALL', 
        device_twilio_number        TEXT                NOT NULL,
        is_displayed                BOOLEAN             NOT NULL,
        is_sending_alerts           BOOLEAN             NOT NULL,
        is_sending_vitals           BOOLEAN             NOT NULL
    );

    -- Create the Sessions_new table
    CREATE TABLE Sessions_new (
        session_id                  UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        device_id                   UUID                NOT NULL REFERENCES Devices_new(device_id) ON DELETE CASCADE,
        created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
        ended_at                    TIMESTAMPTZ,
        session_status              session_status_enum NOT NULL,
        survey_sent                 BOOLEAN,
        selected_survey_category    INT,
        attending_responder_number  TEXT,
        response_time               INTERVAL 
    );

    -- Create the Events_new table
    CREATE TABLE Events_new (
        event_id                    UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        session_id                  UUID                NOT NULL REFERENCES Sessions_new(session_id) ON DELETE CASCADE,
        event_type                  event_type_enum     NOT NULL,
        event_type_details          TEXT,
        event_sent_at               TIMESTAMPTZ         NOT NULL DEFAULT NOW()
    );

    -- Create the Vitals_new table
    CREATE TABLE Vitals_new (
        vital_id                    UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        device_id                   UUID                NOT NULL REFERENCES Devices_new(device_id) ON DELETE CASCADE,
        vital_type                  vital_type_enum     NOT NULL,
        vital_sent_at               TIMESTAMPTZ         NOT NULL DEFAULT NOW()
    );

    -- Trigger functions
    CREATE OR REPLACE FUNCTION update_timestamp_trigger_fn()
    RETURNS TRIGGER AS $t$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $t$ LANGUAGE plpgsql;
    
    CREATE OR REPLACE FUNCTION add_clients_extension_trigger_fn()
    RETURNS TRIGGER AS $t$
    BEGIN
        INSERT INTO Clients_Extension_new(client_id) 
        VALUES (NEW.client_id)
        ON CONFLICT (client_id)
        DO NOTHING;
        RETURN NEW;
    END;
    $t$ LANGUAGE plpgsql;

    -- Trigger: create new default client extension with each new client
    CREATE TRIGGER add_clients_extension_trigger
    AFTER INSERT ON public.Clients_new
    FOR EACH ROW EXECUTE PROCEDURE add_clients_extension_trigger_fn();

    -- Trigger: updated_at timestamp
    CREATE TRIGGER clients_update_timestamp_trigger
    BEFORE UPDATE ON public.Clients_new
    FOR EACH ROW EXECUTE PROCEDURE update_timestamp_trigger_fn();

    CREATE TRIGGER clients_extension_update_timestamp_trigger
    BEFORE UPDATE ON public.Clients_Extension_new
    FOR EACH ROW EXECUTE PROCEDURE update_timestamp_trigger_fn();

    CREATE TRIGGER devices_update_timestamp_trigger
    BEFORE UPDATE ON public.Devices_new
    FOR EACH ROW EXECUTE PROCEDURE update_timestamp_trigger_fn();

    CREATE TRIGGER sessions_update_timestamp_trigger
    BEFORE UPDATE ON public.Sessions_new
    FOR EACH ROW EXECUTE PROCEDURE update_timestamp_trigger_fn();
   
    -- Add indexes (for faster querying)
    CREATE INDEX idx_clients_new_display_name ON public.Clients_new(display_name);

    CREATE INDEX idx_clients_extension_new_country ON public.Clients_Extension_new(country);
    CREATE INDEX idx_clients_extension_new_city ON public.Clients_Extension_new(city);

    CREATE INDEX idx_devices_new_location_id ON public.Devices_new(location_id);
    CREATE INDEX idx_devices_new_display_name ON public.Devices_new(display_name);
    CREATE INDEX idx_devices_new_client_id ON public.Devices_new(client_id);

    CREATE INDEX idx_sessions_new_device_id ON public.Sessions_new(device_id);
    CREATE INDEX idx_sessions_new_session_status ON public.Sessions_new(session_status);
    CREATE INDEX idx_sessions_new_created_at ON public.Sessions_new(created_at);

    CREATE INDEX idx_events_new_session_id ON public.Events_new(session_id);
    CREATE INDEX idx_events_new_event_type ON public.Events_new(event_type);

    CREATE INDEX idx_vitals_new_device_id ON public.Vitals_new(device_id);
    CREATE INDEX idx_vitals_new_vital_type ON public.Vitals_new(vital_type);
END $create_tables$;

-- Data migration
DO $migration$
DECLARE
    migrationId INT;
    lastSuccessfulMigrationId INT;
BEGIN
    migrationId := 55;
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

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
            incident_categories,
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

        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;