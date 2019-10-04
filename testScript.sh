#!/bin/bash

echo "This is the ODetect Testing Script \nPlease enter the device type and data that you want to generate sensor data for, separated by a space, you can enter multiple lines"
while IFS=" " read -r devicetype first second third fourth fifth; do
    if [[ "$devicetype" == "XeThru" ]]; then
      sleep 2
      psql -U brave -d brave -c "INSERT INTO xethru_sensordata (deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s) VALUES ('1', 'BraveOffice', 'XeThru', '$first', '$second', '$third', '$fourth', '$fifth');"
    elif [[ "$devicetype" == "Motion" ]]; then
      sleep 2
      psql -U brave -d brave -c "INSERT INTO motion_sensordata (deviceid, locationid, devicetype, signal) VALUES ('1', 'BraveOffice', 'Motion', '$first');"
    elif [[ "$devicetype" == "Door" ]]; then
      sleep 2
      psql -U brave -d brave -c "INSERT INTO door_sensordata (deviceid, locationid, devicetype, signal) VALUES ('1', 'BraveOffice', 'Door', '$first');"
    else
      echo "Error: \nsensor needs to be one of xethru, door, or motion"
      exit 1
    fi
done
