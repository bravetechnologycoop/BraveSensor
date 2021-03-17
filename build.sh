#!/bin/bash

doctl registry login

# Check if the repository already has a container with this tag
if ! [[ $(doctl registry repository list-tags --format Tag --no-header odetect-prod | grep $(git log -1 --format=%h)) ]]; then
    docker build -t registry.digitalocean.com/odetect/odetect-prod:$(git log -1 --format=%h) .
    docker push registry.digitalocean.com/odetect/odetect-prod:$(git log -1 --format=%h)
fi
