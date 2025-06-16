DO $migration$
DECLARE
    migrationId INT := 62;
    lastSuccessfulMigrationId INT;
BEGIN
    SELECT MAX(id) INTO lastSuccessfulMigrationId FROM migrations;

    IF migrationId - lastSuccessfulMigrationId = 1 THEN

        CREATE OR REPLACE FUNCTION update_vitals_cache_fn()
        RETURNS TRIGGER AS $t$
        BEGIN
            INSERT INTO Vitals_Cache (
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

        -- ===== Record success =====
        INSERT INTO migrations (id) VALUES (migrationId);
    END IF;
END $migration$;
