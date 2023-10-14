DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 18;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        DELETE from sessions where od_flag = 0;
        DELETE from sessions where od_flag is null;
        UPDATE sessions set alert_reason='Unknown' where alert_reason is null;

        ALTER TABLE sessions
            DROP still_counter,
            DROP od_flag,
            DROP duration,
            ALTER start_time TYPE timestamptz,
            ALTER start_time SET DEFAULT now(),
            ALTER start_time SET NOT NULL;

        ALTER TABLE sessions ADD id UUID NULL;
        -- Converting sequential integer id to hexadecimal string for conversion to UUID. See https://cleanspeak.com/blog/2015/09/23/postgresql-int-to-uuid
        UPDATE sessions SET id = CAST(LPAD(TO_HEX(sessionid), 32, '0') AS UUID);
        ALTER TABLE sessions 
            DROP sessionid,
            ALTER id SET NOT NULL,
            ALTER id SET DEFAULT gen_random_uuid(),
            ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

        ALTER TABLE sessions RENAME start_time TO created_at;
        ALTER TABLE sessions RENAME incidenttype TO incident_type;
        ALTER TABLE sessions RENAME phonenumber to phone_number;
        ALTER TABLE sessions ADD COLUMN updated_at timestamptz;
        UPDATE sessions set updated_at = end_time;

        ALTER TABLE sessions drop column end_time;
        ALTER TABLE sessions ALTER updated_at SET DEFAULT now();
        ALTER TABLE sessions ALTER updated_at SET NOT NULL;


        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $t$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS set_sessions_timestamp ON sessions;

        CREATE TRIGGER set_sessions_timestamp
        BEFORE UPDATE ON sessions
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        ALTER TABLE locations RENAME mov_threshold TO movement_threshold;
        ALTER TABLE locations RENAME still_threshold TO stillness_timer;
        ALTER TABLE locations RENAME duration_threshold TO duration_timer;
        ALTER TABLE locations RENAME door_stickiness_delay TO initial_timer;
        ALTER TABLE locations RENAME phonenumber TO responder_phone_number;

        -- This timer is changing from being expressed in milliseconds to seconds
        UPDATE locations set initial_timer = cast (initial_timer as int) / 1000;

        ALTER TABLE locations DROP COLUMN noisemap;
        ALTER TABLE locations DROP COLUMN led;
        ALTER TABLE locations DROP COLUMN sensitivity;
        ALTER TABLE locations DROP COLUMN rpm_threshold;
        ALTER TABLE locations DROP COLUMN auto_reset_threshold;
        ALTER TABLE locations ADD COLUMN firmware_state_machine boolean NOT NULL DEFAULT false;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;