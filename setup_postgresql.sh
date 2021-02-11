sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE --set=sslmode=require -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"'
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE --set=sslmode=require -f ./db/001-setup.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE --set=sslmode=require -f ./db/002-hypertable.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE --set=sslmode=require -f ./db/003-locations_add_columns_set_defaults.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE --set=sslmode=require -f ./db/004-fallbackphone.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE --set=sslmode=require -f ./db/005-human_read_location.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE --set=sslmode=require -f ./db/006-sessions-alertReason.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE --set=sslmode=require -f ./db/007-rename_location_human.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE --set=sslmode=require -f ./db/008-drop_unused_tables.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE --set=sslmode=require -f ./db/009-add-particlecoreid-to-locations.sql