#!/bin/bash

doctl registry login
docker build -t registry.digitalocean.com/odetect/odetect-dev:$(git log -1 --format=%h) .
docker push registry.digitalocean.com/odetect/odetect-dev:$(git log -1 --format=%h)