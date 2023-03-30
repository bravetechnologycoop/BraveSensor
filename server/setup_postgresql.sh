#!/bin/bash

pg_password=$1
pg_user=$2
pg_host=$3
pg_dbname=$4
pg_port=$5

for file in $(ls -v db/*.sql); do
  echo "Running script $file"
  PGPASSWORD=$pg_password psql -U $pg_user -h $pg_host -d $pg_dbname -p $pg_port -v "ON_ERROR_STOP=1" --set=sslmode=require -f ./$file
done
