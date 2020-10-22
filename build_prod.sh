#!/bin/bash

doctl registry login
docker build . -t registry.digitalocean.com/odetect/odetect-prod
docker push registry.digitalocean.com/odetect/odetect-prod
