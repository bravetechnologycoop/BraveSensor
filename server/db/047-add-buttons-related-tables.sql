DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 47;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- buttons_vitals table
        CREATE TABLE buttons_vitals (
            id uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
            device_id uuid REFERENCES devices (id) NOT NULL,
            battery_level integer,
            created_at timestamp with time zone NOT NULL DEFAULT NOW(),
            snr numeric,
            rssi integer
        );

        -- buttons_vitals_cache table
        CREATE TABLE buttons_vitals_cache (
            id uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
            device_id uuid REFERENCES devices (id) NOT NULL,
            CONSTRAINT buttons_vitals_cache_device_id_key UNIQUE (device_id),
            battery_level integer,
            created_at timestamp with time zone NOT NULL DEFAULT NOW(),
            updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
            snr numeric,
            rssi integer
        );

        -- buttons_vitals_cache_device_id_idx index for column device_id
        CREATE INDEX buttons_vitals_cache_device_id_idx ON buttons_vitals_cache (device_id);

        -- update the timestamp on every update to buttons_vitals_cache
        CREATE TRIGGER set_buttons_vitals_cache_timestamp
        BEFORE UPDATE ON buttons_vitals_cache
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();

        -- replace the trigger to insert or update buttons_vitals_cache every time a new row is added to buttons_vitals
        CREATE OR REPLACE FUNCTION create_buttons_vitals_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO buttons_vitals_cache (id, device_id, battery_level, created_at) 
            VALUES (NEW.id, NEW.device_id, NEW.battery_level, NEW.created_at)
            ON CONFLICT (device_id)
            DO UPDATE SET
                id = NEW.id,
                battery_level = NEW.battery_level,
                created_at = NEW.created_at;
            RETURN NEW;
        END;
        $t$;

        -- trigger the above function on every update on buttons_vitals
        CREATE TRIGGER create_buttons_vitals_trigger
        BEFORE INSERT OR UPDATE ON buttons_vitals
        FOR EACH ROW
        EXECUTE FUNCTION create_buttons_vitals_trigger_fn();

        -- create gateways table
        CREATE TABLE gateways (
            id uuid PRIMARY KEY NOT NULL,
            client_id uuid REFERENCES clients (id) NOT NULL,
            display_name text NOT NULL,
            created_at timestamp with time zone NOT NULL DEFAULT NOW(),
            updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
            sent_vitals_alert_at timestamp with time zone,
            is_displayed boolean,
            is_sending_vitals boolean
        );

        -- update the timestamp on every update to gateways
        CREATE TRIGGER set_gateways_timestamp
        BEFORE UPDATE ON gateways
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();

        -- create gateways_vitals table
        CREATE TABLE gateways_vitals (
            id uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
            gateway_id uuid REFERENCES gateways (id) NOT NULL,
            last_seen_at timestamp with time zone NOT NULL,
            created_at timestamp with time zone NOT NULL DEFAULT NOW()
        );

        -- create gateways_vitals_cache table
        CREATE TABLE gateways_vitals_cache (
            id uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
            gateway_id uuid REFERENCES gateways (id) NOT NULL,
            CONSTRAINT gateways_vitals_cache_gateway_id_key UNIQUE (gateway_id),
            last_seen_at timestamp with time zone NOT NULL,
            created_at timestamp with time zone NOT NULL DEFAULT NOW()
        );

        -- gateways_vitals_cache_device_id_idx index for column gateway_id
        CREATE INDEX gateways_vitals_cache_gateway_id_idx ON gateways_vitals_cache (gateway_id);

        -- update the timestamp on every update to gateways_vitals_cache
        CREATE TRIGGER set_gateways_vitals_cache_timestamp
        BEFORE UPDATE ON gateways_vitals_cache
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();

        -- Add trigger to insert or update gateways_vitals_cache every time a new row is added to gateways_vitals
        CREATE OR REPLACE FUNCTION create_gateways_vitals_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO gateways_vitals_cache (id, gateway_id, last_seen_at, created_at) 
            VALUES (NEW.id, NEW.gateway_id, NEW.last_seen_at, NEW.created_at)
            ON CONFLICT (gateway_id)
            DO UPDATE SET
                id = NEW.id,
                last_seen_at = NEW.last_seen_at,
                created_at = NEW.created_at;
            RETURN NEW;
        END;
        $t$;

        -- trigger the above function on every update on gateways_vitals
        CREATE TRIGGER create_gateways_vitals_trigger
        BEFORE INSERT OR UPDATE ON gateways_vitals
        FOR EACH ROW
        EXECUTE FUNCTION create_gateways_vitals_trigger_fn();

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
