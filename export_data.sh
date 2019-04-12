#!/bin/bash

sudo -u postgres psql -d brave -t -A -F "," -c "SELECT * FROM xethru_sensordata" > xethru_sensordata.csv
sudo -u postgres psql -d brave -t -A -F "," -c "SELECT * FROM motion_sensordata" > motion_sensordata.csv
sudo -u postgres psql -d brave -t -A -F "," -c "SELECT * FROM door_sensordata" > door_sensordata.csv
