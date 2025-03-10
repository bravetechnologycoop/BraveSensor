#!/bin/bash

sudo -u postgres psql -c "CREATE ROLE $PG_USER WITH PASSWORD '$PG_PASSWORD' LOGIN;"
sudo -u postgres createdb -O "$PG_USER" "$PG_DATABASE"
sudo -u postgres psql -d "$PG_DATABASE" -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'
./setup_postgresql.sh "$PG_PASSWORD" "$PG_USER" "$PG_HOST" "$PG_DATABASE" "$PG_PORT"