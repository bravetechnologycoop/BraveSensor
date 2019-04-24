CREATE TABLE IF NOT EXISTS door_sensordata
(
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
    chatbot_state text,
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
	noisemap text COLLATE pg_catalog."default"
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;