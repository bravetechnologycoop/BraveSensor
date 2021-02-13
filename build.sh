#!/bin/bash

doctl registry login
docker build -t registry.digitalocean.com/odetect/odetect-prod:$(git log -1 --format=%h) .
docker push registry.digitalocean.com/odetect/odetect-prod:$(git log -1 --format=%h)
