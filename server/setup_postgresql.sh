#!/bin/bash

if [[ -z "${PG_PASSWORD}" ]]; then
  pg_password=$1
else
  pg_password="${PG_PASSWORD}"
fi

if [[ -z "${PG_USER}" ]]; then
  pg_user=$2
else
  pg_user="${PG_USER}"
fi

if [[ -z "${PG_HOST}" ]]; then
  pg_host=$3
else
  pg_host="${PG_HOST}"
fi

if [[ -z "${PG_DATABASE}" ]]; then
  pg_dbname=$4
else
  pg_dbname="${PG_DATABASE}"
fi

if [[ -z "${PG_PORT}" ]]; then
  pg_port=$5
else
  pg_port="${PG_PORT}"
fi

for file in $(ls -v db/*.sql); do
  echo "Running script $file"
  PGPASSWORD=$pg_password psql -U $pg_user -h $pg_host -d $pg_dbname -p $pg_port -v "ON_ERROR_STOP=1" --set=sslmode=require -f ./$file
done
