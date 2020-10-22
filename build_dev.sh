#!/bin/bash

doctl registry login
docker build . -t registry.digitalocean.com/odetect/odetect-dev
docker push registry.digitalocean.com/odetect/odetect-dev