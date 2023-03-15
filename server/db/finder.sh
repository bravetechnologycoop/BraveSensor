#!/bin/bash

# Your SQL query output, passed as an argument to the shell script
query_output=$1
pg_password=$2
pg_user=$3
pg_host=$4
pg_dbname=$5
pg_port=$6

# Check if the query output contains string in the error message that the table "does not exist"
if [[ $query_output == *"does not exist"* ]]; then
  # The migrations table does not exist, so create it
  echo "Running scripts to create tables"
  for file in $(ls -v *.sql); do
    echo "Running script $file"
    PGPASSWORD=$pg_password psql -U $pg_user -h $pg_host -d $pg_dbname -p $pg_port -v "ON_ERROR_STOP=1" --set=sslmode=require -f ./$file
  done
else
  # The migrations table exists, so continue with the rest of your script
  echo "Migrations table exists, continuing with script"
  array=()
  for file in *.sql
  do
  if [ ${file:0:3} -gt $query_output ]
  then
  array+=($file)
  else
    echo "$file already Migrated"
  fi
  done
  for value in "${array[@]}"
  do
      echo "$value needs to be Migrated"
  done

  for object in "${array[@]}"
  do
      PGPASSWORD=$pg_password psql -U $pg_user -h $pg_host -d $pg_dbname -p $pg_port -v "ON_ERROR_STOP=1" --set=sslmode=require -f ./$object
  done

fi