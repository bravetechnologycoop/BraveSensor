# ODetect-Backend-Local

[![Build Status](https://travis-ci.com/bravetechnologycoop/ODetect-Backend-Local.svg?branch=master)](https://travis-ci.com/bravetechnologycoop/ODetect-Backend-Local)

## Setup

1. Run `npm install` to download all the required node modules
1. To build the front end `npx @angular/cli build --prod`
1. Move the build files to the expected location usinv `mv dist/ODetect ../ODetect-Backend-Local/Public/ODetect`

## Tests

Unit tests are written using the [Mocha](https://mochajs.org/) JS test framework
and the [Chai](https://www.chaijs.com/) assertion library.

Tests run automatically on Travis on every checkin and every time a pull request
is created

### To run the tests locally

1. Run `npm test`

## Before building a docker image

Before deployment of a new Docker container to the kubernetes cluster, check that the following are in place

### Frontend artifacts

The ODetect front end is built using Angular JS. Once built locally, the front end artifacts are stored in the `/Public/ODetect` folder. Instructions on locally building the front end are in the Setup section. 

In case you are not building the front end locally, you may download a zip file of the front end artifacts from the shared ODetect vault on 1password and unzip to the above folder.

### Smartthings Public Key

The Samsung Smartthings Smartapp requires a public key to work, the public keys for the dev and prod environments are stored on the ODetect vault on 1password. Copy the contents of the public key into a file called `smartthings_rsa.pub`

### Env files

The env files contain important secrets such as Twilio credentials, Postgres credentials as well as the IP address of the Env files for the production and development deployments are stored on the 1password ODetect vault.

Copy *only* one of the prod/dev env files from 1password to the `/ODetect-Backend-Local` folder on your local machine.

### Redis cluster IP

The local cluster IP of the redis deployment is a required parameter for the node application to open a connection to the database. To obtain this cluster IP, first confirm that the necessary deployment is running on the kubernetes cluster. From the ODetect-admin server, run - Access details are [here](#access-odetect-admin-server)

`kubectl get pods`

If there is no redis deployment, create a new deployment from a manifest by

1. Checkout the desired git branch (main/dev) to the admin server

1. Within the admin server, navigate to `/manifests` and apply the desired manifest to the kubernetes cluster using `kubectl apply -f desired_manifest.yaml`

If there is a redis deployment (redis-dev or redis-master), note the cluster IP from the result of kubectl get pods and copy that value to the `.env` file

## Docker Containers

Docker commands are run locally. Please install Docker to be able to run these commands on your local machine. To be able to push images to the DO container registry, you will need to be authenticated as a member of our DO ODetect project.  

1. tag the built docker image according to `docker build . registry.digitalocean.com/odetect/<desired-tag-name>`. Currently, odetect-prod is used for the production deployment and odetect-dev for the development deployment (as specified in `/mainfests/odetect-deployment.yaml` and `/manifests/odetect-deployment-dev.yaml`)

1. Push the new image to the registry `docker push registry.digitalocean.com/odetect/<desired-tag-name>`

## Deployment

Kubernetes commands are run on the ODetect Admin Server.

### Access ODetect Admin Server

Run `ssh brave@odetect-admin.brave.coop` to ssh into the admin server. Access is restricted to machines whose public key has been added to the server's allowlist

#### Adding public keys to the admin server

Paste the public key onto a new line on the `~/.ssh/authorized_keys` file on the ODetect admin server from a machine that is capable of accessing the server already.

Password access to the server is also available (credentials on 1password)

### Restart deployment

- Restarting a deployment once a docker image has been updated. Our cluster is not setup to automatically pull the new image and restart. Rather, we do it manually.

`kubectl rollout restart deployment/<desired-deployment>`

## Database migration

### Adding a new Database migration script

This strategy assumes that each migration script in the db directory has a unique positive integer migration ID, and that each script's migration ID is exactly one greater than the previous script's migration ID. Otherwise, the scripts will not run.

1. Copy `db/000-template.sql` and name it with the desired migration ID (padded with zeros) followed by a short description of what it does eg. `005-newColumn.sql`

2. Update the file with its migration ID and the new migration scripts

### Deploying the migration scripts

1. Pull the branch with the migration script to be applied onto the remote ODetect-Admin server (which is permitted to access the database)

2. Run the postgres connection string command and pass the `db/00x-migration-script.sql` file to it with the `-f` flag

The connection string looks like

``` postgres
PGPASSWORD=password psql -U user -h databaseAddress -p 25060 -d databaseName --set=sslmode=require
```

This connection string may be copied from digital ocean.

To view which migration scripts have been run and when

``` postgres
SELECT *
FROM migrations
ORDER BY id;
```

## Databases currently used

| Deployment        | Name            | User    | Database            |
|-------------------|-----------------|---------|---------------------|
| Production (prod) | odetect-db      | doadmin | backend-replacement |
| Development (dev) | odetect-db-fork | doadmin | defaultdb           |

## Useful commands

### Kubernetes

- Entering a pod's shell

`kubectl exec -i -t <my-pod>  -- /bin/bash`

- Getting logs from a pod

`kubectl logs my-pod -f` (to follow)
