DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 55;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId 
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        
        -- Table creation
        -- New tables are created instead of alerting existing tables to:
        -- 1. Not loose any sort of existing data 
        -- 2. Not loose some of the functionality that is working with old tables like pa or dashboard
        -- 3. Can be tested and released independently, then tables can be remaned and alerted

        -- Create Enum Types for status and event types
        CREATE TYPE device_status_enum AS ENUM ('TESTING', 'SHIPPED', 'LIVE');
        CREATE TYPE device_types_enum AS ENUM ('SENSOR_SINGLESTALL', 'SENSOR_MULTISTALL');
        CREATE TYPE session_status_enum AS ENUM ('ACTIVE', 'COMPLETED');
        CREATE TYPE event_type_enum AS ENUM ('DURATION_ALERT', 'STILLNESS_ALERT', 'DOOR_OPENED', 'MSG_SENT', 'CALL', 'MSG_RECEIVED');
        CREATE TYPE notification_type_enum AS ENUM ('DOOR_LOW_BATTERY', 'DOOR_TAMPERED', 'DOOR_INACTIVITY', 'DEVICE_DISCONNECTED', 'DEVICE_DISCONNECTED_REMINDER', 'DOOR_DISCONNECTED', 'DOOR_DISCONNECTED_REMINDER', 'DEVICE_RECONNECTED');
        
        -- Create the Clients_new table
        CREATE TABLE IF NOT EXISTS Clients_new (
            client_id                   UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            display_name                TEXT                NOT NULL UNIQUE,
            language                    TEXT                NOT NULL DEFAULT 'en',
            created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
            updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
            responder_phone_numbers     TEXT[]              NOT NULL DEFAULT '{}'::text[],
            fallback_phone_numbers      TEXT[]              NOT NULL DEFAULT '{}'::text[],
            vitals_twilio_number        TEXT                NOT NULL,
            vitals_phone_numbers        TEXT[]              NOT NULL DEFAULT '{}'::text[],
            survey_categories           TEXT[]              NOT NULL DEFAULT '{"Overdose Event","Emergency Event","Occupant Okay","Space Empty","Other","Report technical issue"}'::text[], 
            is_displayed                BOOLEAN             NOT NULL,
            devices_sending_alerts      BOOLEAN             NOT NULL,
            devices_sending_vitals      BOOLEAN             NOT NULL,
            devices_status              device_status_enum  NOT NULL DEFAULT 'LIVE',
            first_device_live_at        DATE
        );

        -- Create the Clients_Extension_new table
        CREATE TABLE IF NOT EXISTS Clients_Extension_new (
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

        CREATE TABLE IF NOT EXISTS Devices_new (
            device_id                   UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            display_name                TEXT                NOT NULL,
            location_id                 TEXT                NOT NULL UNIQUE,
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
        CREATE TABLE IF NOT EXISTS Sessions_new (
            session_id                  UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            device_id                   UUID                NOT NULL REFERENCES Devices_new(device_id) ON DELETE CASCADE,
            created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
            updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
            session_status              session_status_enum NOT NULL,
            attending_responder_number  TEXT,
            door_opened                 BOOLEAN             NOT NULL DEFAULT false,
            survey_sent                 BOOLEAN             NOT NULL DEFAULT false,
            selected_survey_category    TEXT,
            response_time               INTERVAL 
        );

        -- Create the Events_new table
        -- Events occur in an session
        CREATE TABLE IF NOT EXISTS Events_new (
            event_id                    UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            session_id                  UUID                NOT NULL REFERENCES Sessions_new(session_id) ON DELETE CASCADE,
            event_type                  event_type_enum     NOT NULL,
            event_type_details          TEXT,
            event_sent_at               TIMESTAMPTZ         NOT NULL DEFAULT NOW()
        );

        -- Create the Vitals_new table
        CREATE TABLE IF NOT EXISTS Vitals_new (
            vital_id                    UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            device_id                   UUID                NOT NULL REFERENCES Devices_new(device_id) ON DELETE CASCADE,
            created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
            device_last_reset_reason    TEXT                NOT NULL,
            door_last_seen_at           TIMESTAMPTZ         NOT NULL,
            door_low_battery            BOOLEAN             NOT NULL,
            door_tampered               BOOLEAN             NOT NULL,
            door_missed_count           INT                 NOT NULL,    
            consecutive_open_door_count INT                 NOT NULL
        );

        -- Create the Vitals_Cache_new table
        CREATE TABLE IF NOT EXISTS Vitals_Cache_new (
            vital_id                    UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            device_id                   UUID                NOT NULL REFERENCES Devices_new(device_id) ON DELETE CASCADE UNIQUE,
            created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
            device_last_reset_reason    TEXT                NOT NULL,
            door_last_seen_at           TIMESTAMPTZ         NOT NULL,
            door_low_battery            BOOLEAN             NOT NULL,
            door_tampered               BOOLEAN             NOT NULL,
            door_missed_count           INT                 NOT NULL,    
            consecutive_open_door_count INT                 NOT NULL,
            updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
        );

        -- Create the Notifications_new table
        -- Notifications occur independently for a device
        CREATE TABLE IF NOT EXISTS Notifications_new (
            notification_id             UUID                    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            device_id                   UUID                    NOT NULL REFERENCES Devices_new(device_id) ON DELETE CASCADE,
            notification_type           notification_type_enum  NOT NULL,
            notification_sent_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW()
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

                CREATE OR REPLACE FUNCTION update_vitals_cache_fn()
        RETURNS TRIGGER AS $t$
        BEGIN
            INSERT INTO Vitals_Cache_new (
                vital_id, device_id, created_at, device_last_reset_reason,
                door_last_seen_at, door_low_battery, door_tampered, door_missed_count,
                consecutive_open_door_count
            ) 
            VALUES (
                NEW.vital_id, NEW.device_id, NEW.created_at, NEW.device_last_reset_reason,
                NEW.door_last_seen_at, NEW.door_low_battery, NEW.door_tampered, NEW.door_missed_count,
                NEW.consecutive_open_door_count
            )
            ON CONFLICT (device_id)
            DO UPDATE SET
                vital_id = NEW.vital_id,
                created_at = NEW.created_at,
                device_last_reset_reason = NEW.device_last_reset_reason,
                door_last_seen_at = NEW.door_last_seen_at,
                door_low_battery = NEW.door_low_battery,
                door_tampered = NEW.door_tampered,
                door_missed_count = NEW.door_missed_count,
                consecutive_open_door_count = NEW.consecutive_open_door_count;
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;
        
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
    
        -- Trigger: create new default client extension with each new client
        CREATE TRIGGER add_clients_extension_trigger
        AFTER INSERT ON public.Clients_new
        FOR EACH ROW EXECUTE PROCEDURE add_clients_extension_trigger_fn();
        
        -- Trigger: Add trigger to update cache on new vitals
        CREATE TRIGGER update_vitals_cache_trigger
        AFTER INSERT ON Vitals_new
        FOR EACH ROW EXECUTE PROCEDURE update_vitals_cache_fn();

        -- Add indexes (for faster querying)
        -- Client indices
        CREATE INDEX idx_clients_new_display_name ON public.Clients_new(display_name);
        CREATE INDEX idx_clients_extension_new_country ON public.Clients_Extension_new(country);
        CREATE INDEX idx_clients_extension_new_city ON public.Clients_Extension_new(city);

        -- Device indices
        CREATE INDEX idx_devices_new_location_id ON public.Devices_new(location_id);
        CREATE INDEX idx_devices_new_display_name ON public.Devices_new(display_name);
        CREATE INDEX idx_devices_new_client_id ON public.Devices_new(client_id);

        -- Session and Event indices
        CREATE INDEX idx_sessions_new_device_id ON public.Sessions_new(device_id);
        CREATE INDEX idx_sessions_new_session_status ON public.Sessions_new(session_status);
        CREATE INDEX idx_sessions_new_created_at ON public.Sessions_new(created_at);
        CREATE INDEX idx_events_new_session_id ON public.Events_new(session_id);
        CREATE INDEX idx_events_new_event_type ON public.Events_new(event_type);

        -- Vitals indices
        CREATE INDEX idx_vitals_new_device_id ON public.Vitals_new(device_id);
        CREATE INDEX idx_vitals_new_created_at ON public.Vitals_new(created_at DESC);
        CREATE INDEX idx_vitals_new_door_last_seen_at ON public.Vitals_new(door_last_seen_at DESC);
        CREATE INDEX idx_vitals_cache_new_device_id ON public.Vitals_Cache_new(device_id);
        CREATE INDEX idx_vitals_cache_new_created_at ON public.Vitals_Cache_new(created_at DESC);

        -- Notification indices
        CREATE INDEX idx_notifications_new_device_id ON public.Notifications_new(device_id);
        CREATE INDEX idx_notifications_new_notification_type ON public.Notifications_new(notification_type);
        CREATE INDEX idx_notifications_new_sent_at ON public.Notifications_new(notification_sent_at DESC);

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;