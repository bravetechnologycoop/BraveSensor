DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 1;

    -- Table to store the current migration state of the DB
    CREATE TABLE IF NOT EXISTS migrations (
        id INT PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT NOW()
    );

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF lastSuccessfulMigrationId IS NULL THEN
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        
        CREATE TABLE IF NOT EXISTS door_sensordata (
            published_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
            deviceid text COLLATE pg_catalog."default",
            locationid text COLLATE pg_catalog."default",
            devicetype text COLLATE pg_catalog."default",
            signal text COLLATE pg_catalog."default"
        )
    WITH (
        OIDS = FALSE
        )
    TABLESPACE pg_default;

        CREATE TABLE IF NOT EXISTS motion_sensordata
        (
            published_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deviceid text COLLATE pg_catalog."default",
            devicetype text COLLATE pg_catalog."default",
            signal text COLLATE pg_catalog."default",
            locationid text COLLATE pg_catalog."default"
        )
        WITH (
            OIDS = FALSE
        )
        TABLESPACE pg_default;


        CREATE TABLE IF NOT EXISTS xethru_sensordata
        (
            published_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
            state integer,
            rpm double precision,
            distance double precision,
            mov_f double precision,
            mov_s double precision,
            deviceid integer,
            locationid text COLLATE pg_catalog."default",
            devicetype text COLLATE pg_catalog."default"
        )
        WITH (
            OIDS = FALSE
        )
        TABLESPACE pg_default;


        CREATE TABLE IF NOT EXISTS states
        (
            locationid text COLLATE pg_catalog."default",
            state text COLLATE pg_catalog."default",
            published_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
        )
        WITH (
            OIDS = FALSE
        )
        TABLESPACE pg_default;


        CREATE TABLE IF NOT EXISTS sessions
        (
            locationid text COLLATE pg_catalog."default",
            start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
            end_time timestamp without time zone,
            od_flag integer,
            state text COLLATE pg_catalog."default",
            phonenumber text COLLATE pg_catalog."default",
            notes text COLLATE pg_catalog."default",
            incidenttype text COLLATE pg_catalog."default",
            sessionid SERIAL,
            duration text,
            still_counter integer DEFAULT 0,
            chatbot_state text
        )
        WITH (
            OIDS = FALSE
        )
        TABLESPACE pg_default;


        CREATE TABLE IF NOT EXISTS locations
        (
            locationid text COLLATE pg_catalog."default",
            deviceid text COLLATE pg_catalog."default",
            phonenumber text COLLATE pg_catalog."default",
            detectionzone_min text COLLATE pg_catalog."default",
            detectionzone_max text COLLATE pg_catalog."default",
            sensitivity text COLLATE pg_catalog."default",
            led text COLLATE pg_catalog."default",
            noisemap text COLLATE pg_catalog."default",
            mov_threshold text COLLATE pg_catalog."default",
            duration_threshold text COLLATE pg_catalog."default",
            still_threshold text COLLATE pg_catalog."default",
            rpm_threshold text COLLATE pg_catalog."default",
            xethru_sent_alerts boolean DEFAULT FALSE,
            xethru_heartbeat_number text COLLATE pg_catalog."default"
        )
        WITH (
            OIDS = FALSE
        )
        TABLESPACE pg_default;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
