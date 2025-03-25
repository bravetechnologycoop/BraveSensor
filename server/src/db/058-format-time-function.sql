DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 58;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId 
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        
        -- Create the format_time_difference function
        -- Reusable for batch and single queries to improve performace
        CREATE OR REPLACE FUNCTION format_time_difference(target_time TIMESTAMPTZ)
        RETURNS TEXT AS $$
        DECLARE
            total_seconds NUMERIC;
        BEGIN
            total_seconds := EXTRACT(EPOCH FROM age(NOW(), target_time));
            
            RETURN CASE
                WHEN total_seconds >= 86400 THEN
                    floor(total_seconds/86400)::text || 
                    CASE WHEN floor(total_seconds/86400) = 1 THEN ' day, ' ELSE ' days, ' END ||
                    floor((total_seconds%86400)/3600)::text ||
                    CASE WHEN floor((total_seconds%86400)/3600) = 1 THEN ' hour, ' ELSE ' hours, ' END ||
                    floor((total_seconds%3600)/60)::text ||
                    CASE WHEN floor((total_seconds%3600)/60) = 1 THEN ' minute' ELSE ' minutes' END
                ELSE
                    floor(total_seconds/3600)::text ||
                    CASE WHEN floor(total_seconds/3600) = 1 THEN ' hour, ' ELSE ' hours, ' END ||
                    floor((total_seconds%3600)/60)::text ||
                    CASE WHEN floor((total_seconds%3600)/60) = 1 THEN ' minute, ' ELSE ' minutes, ' END ||
                    floor(total_seconds%60)::text ||
                    CASE WHEN floor(total_seconds%60) = 1 THEN ' second' ELSE ' seconds' END
            END || ' ago';
        END;
        $$ LANGUAGE plpgsql;

        -- Update the migration ID
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;