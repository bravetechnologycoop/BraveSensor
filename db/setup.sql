CREATE TABLE IF NOT EXISTS public.door_sensordata
(
    published_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deviceid text COLLATE pg_catalog."default",
    locationid PRIMARY KEY text COLLATE pg_catalog."default",
    devicetype text COLLATE pg_catalog."default",
    signal text COLLATE pg_catalog."default"
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.door_sensordata
    OWNER to PG_USER;

CREATE TABLE IF NOT EXISTS public.motion_sensordata
(
    published_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deviceid text COLLATE pg_catalog."default",
    devicetype text COLLATE pg_catalog."default",
    signal text COLLATE pg_catalog."default",
    locationid PRIMARY KEY text COLLATE pg_catalog."default"
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.motion_sensordata
    OWNER to PG_USER;

CREATE TABLE IF NOT EXISTS public.xethru_sensordata
(
    published_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    state integer,
    rpm double precision,
    distance double precision,
    mov_f double precision,
    mov_s double precision,
    deviceid integer,
    locationid PRIMARY KEY text COLLATE pg_catalog."default",
    devicetype text COLLATE pg_catalog."default",
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.xethru_sensordata
    OWNER to PG_USER;

CREATE TABLE IF NOT EXISTS public.states
(
    locationid PRIMARY KEY text COLLATE pg_catalog."default",
    state text COLLATE pg_catalog."default",
    published_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.states
    OWNER to PG_USER;


CREATE TABLE public.sessions
(
    locationid PRIMARY KEY text COLLATE pg_catalog."default",
    start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    end_time timestamp without time zone,
    od_flag integer,
    state text COLLATE pg_catalog."default",
    prev_state text COLLATE pg_catalog."default",
    phonenumber text COLLATE pg_catalog."default",
    notes text COLLATE pg_catalog."default",
    incidenttype text COLLATE pg_catalog."default",
    sessionid integer NOT NULL DEFAULT nextval('sessions_sessionid_seq'::regclass)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.sessions
    OWNER to PG_USER;
