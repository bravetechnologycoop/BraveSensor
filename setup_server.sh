#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")

if [[ $EUID > 0 ]]; then
    echo "this script needs sudo privelages to run correctly."
    cd $original_dir
    exit 1
elif [[ ! -n "$1" ]]; then
    echo "please supply the path to the .env file as the first argument when running this script."
    cd $original_dir
    exit 1
else
    while IFS="=" read -r name value; do
        if [[ "$name" == "PG_USER" ]]; then
            PG_USER="$value"
        elif [[ "$name" == "PG_PASSWORD" ]]; then
            PG_PASSWORD="$value"
        fi
    done < $1

    ufw allow 22
    ufw allow http
    ufw allow https
    ufw enable

    apt-get update
    apt-get install software-properties-common
    add-apt-repository -y ppa:certbot/certbot
    apt-get update
    apt-get install -y nodejs npm certbot postgresql postgresql-contrib
    npm install -g pm2 n
    n stable
    npm install

    sudo -u postgres psql -f ./db/createUser.sql -v username="'$PG_USER'" -v password="$PG_PASSWROD"
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$PG_USER'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE $PG_USER OWNER $PG_USER"
    sudo -u postgres psql -d $PG_USER -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"'
    sudo -u $PG_USER PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -f ./db/001-setup.sql

    certbot certonly --standalone 

    echo "0 0 * * 0 certbot renew --pre-hook 'pm2 stop server' --post-hook 'pm2 start server'" > crontab.tmp
    crontab crontab.tmp
    rm crontab.tmp
    
    pm2 startup systemd
    pm2 start index.js

    cd $original_dir
fi