# BraveSensor-Server

[![Build Status](https://travis-ci.com/bravetechnologycoop/BraveSensor-Server.svg?branch=master)](https://travis-ci.com/bravetechnologycoop/BraveSensor-Server)

# How to release a new version of BraveSensor-Server

## 1. Update git to reflect the new release

1. on your local machine, in the `BraveSensor-Server` repository:

   1. pull the latest code ready for release: `git checkout devenv && git pull origin devenv`

   1. decide on an appropriate version number for the new version

   1. update `CHANGELOG.md` by moving everything in `Unreleased` to a section for the new version

   1. `cd` into the `~/BraveSensor-Server/sensor-helm-chart` directory

      1. Update `Chart.yaml` with a new `version` and new `appVersion`, if applicable

      1. Run `git log -1 --format=%h` to get the container image tag

      1. Update `values.yaml` by putting the tag of your new container image in the `tag` field of `image`

   1. make a new commit directly on `devenv` which updates the changelog and helm chart

   1. tag the new commit - for example, if the version number is v1.0.0, use `git tag v1.0.0`

   1. push the new version to GitHub: `git push origin devenv --tags`

   1. update the `master` branch: `git checkout master && git merge devenv && git push origin master`

## 2. Database changes

If your changes involve changes to the database schema, you'll need to run your database migration script on the appropriate database for your environment. See the [Database Migration section](#database-migration).

**If the database changes are breaking, think carefully about how to do this. It may be preferable to briefly shut down the server rather than risk undefined behavior from changing the database schema before changing the code that's running**

## 3. Environment Variable changes

We deploy BraveSensor-Server onto a [Kubernetes](https://kubernetes.io/docs/home/) cluster as our production environment. On the cluster, environment variables are handled within `secret` resources. You can access the list of secrets on the cluster by running the command:
`kubectl get secrets`

### Creating a secret from a .env file

To create a secret from a .env file, run the following command:

`kubectl create secret generic <your-secret-name> --from-env-file=<path-to-env-file>`

### Altering a secret values after it's been created

If there are any changes to environment variables values, the corresponding Kubernetes secret objects must be changed too.

To update a Kubernetes secret use the command:
`kubectl edit secret <name-of-your-secret>`

The values displayed will be encoded in base64, and new or altered values must also be entered in this encoding. To encode a string, use a command like the following one:

`echo 'mySecretValue' | encode base64`

A easier option is to delete the secret and re-create a new secret from scratch using the method described above for [creating a sensor from an env file](#creating-a-secret-from-a-.env-file). This is safe to do and will not affect running pods.

### Altering a secret's schema

If there are changes to the schema of the environment variables (like the addition or deletion of a key) this change must be reflected in the env variables section of `BraveSensor-Server/sensor-helm-chart/templates/sensor-deployment.yaml`, in addition to changing the Kubernetes secret as described above.

## 4. Deploy changes to the Kubernetes Cluster

We use [helm](https://helm.sh/docs/) to manage our deployments. Helm allows us to deploy different instances of the application corresponding to dev, staging, and production environments as different 'releases'. Before updating production, we run smoke tests to verify that there's nothing obviously wrong with a release candidate.

### Smoke testing

1. Run `ssh brave@sensors-admin.brave.coop`

1. cd into the ~/BraveSensor-Server directory and run `git pull origin master` to get the latest version of the helm chart

1. Run the command `helm upgrade staging --set secretName=sensor-dev --set image.tag=<your new container tag> sensor-helm-chart` to deploy the latest version to staging

1. Run the smoke test script as described [below](#running-smoke-tests-on-the-kubernetes-cluster)

1. Verify that the deployment shows the expected behavior before proceeding

### Updating production

1. Run the command `helm upgrade production sensor-helm-chart`

# Deploying to the staging or development environment

1. Run `ssh brave@sensors-admin.brave.coop`

1. cd into the ~/BraveSensor-Server directory

#### To deploy to staging

1. Run the command `helm upgrade staging --set secretName=sensor-staging --set image.tag=<image tag you want to deploy> sensor-helm-chart`

#### To deploy to development

1. Run the command `helm upgrade dev --set secretName=sensor-dev --set image.tag=<image tag you want to deploy> sensor-helm-chart`

# Build and push a new container manually

Note that a new container is built and pushed automatically by Travis each time there is a successful build.

1. Install Docker locally (https://docs.docker.com/get-docker/ and, if you are running Linux,
   https://docs.docker.com/engine/install/linux-postinstall/)

1. Install and configure `doctl` with your API token (https://www.digitalocean.com/docs/apis-clis/doctl/how-to/install/)

1. Build the Docker image, tag it, and push it to the registry by running

   ```
   ./build.sh
   ```

## Running Smoke Tests on the Kubernetes Cluster

Once a build is deployed to the cluster, you can test basic aspects of its functionality by running the smoketest.js script. The script takes three parameters, a url for a deployment, a recipient phone number, and a Twilio number.:

    `npm run smoketest <server url> <your phone number> <valid Twilio number>`

The twilio number must be a valid number for the account, and must have its SMS webhook pointing at the server you're running the smoketest on. So, for example, if I wanted to run the smoke test with +17781234567 as the recipient phone number, and I knew +17786083684 was a valid twilio number for the deployment I'm testing, I could run the following command:

    `npm run smoketest 'https://staging.odetect.brave.coop' '+17781234567' '+17786083684'`

The script will take a few minutes to conclude. The expected behavior is for a location to be created, and for two sessions to be started - one which closes without generating an alert, and one which results in a 'Stillness' alert to the phone number provided. These two sessions should also be reflected in the frontend dashboard. If you do not answer the alert on your phone, you should notice a notification about a session being restarted. If you do, you should complete the chatbot flow. The process should then repeat, this time with INS radar data.

You can get further details about the behavior of the build by watching logs for the application with:
`kubectl logs -f --timestamps deployment/staging-sensor-server`
and by watching the behavior of redis with:
`kubectl exec deploy/redis-dev redis-cli monitor`

# Local Development

## Dependencies

1. Dowload and install [redis version 6](https://redis.io/download)
1. Download and install [PostgreSQL version 12](https://www.postgresql.org/download/)

Alternately, you have the option of installing these dependencies as docker containers

1. Redis: https://hub.docker.com/_/redis
1. PostgreSQL: https://hub.docker.com/_/postgres

## Environment Variables

For local development, we use .env files to set environment variables. To set one of these up, fill in the values in the .env.example and change it's name to `.env`.

## Database Setup

You will need to populate the .env file with connection parameters for both redis and Postgresql. If you are using a local database you will also need to setup the database schema.

To do this, cd into the BraveSensor-Server directory and run the following command

```
sudo PG_PORT=<your db's port> PG_HOST=<your db's host> PG_PASSWORD=<your db's password> PG_USER=<your db's user> PG_DATABASE=<your db name> setup_postgresql_local.sh
```

## Tests

Unit tests are written using the [Mocha](https://mochajs.org/) JS test framework
and the [Chai](https://www.chaijs.com/) assertion library.

To run the tests locally:

```
npm install
npm run test
```

The tests run automatically on Travis on every push to GitHub and every time a pull request is created.

## How to add or change an encrypted Travis environment variable

Reference: https://docs.travis-ci.com/user/environment-variables/#encrypting-environment-variables

1. Download the Travis CLI `gem install travis`

1. cd to anywhere in this repo

1. temporarily create a personal access token on GitHub https://github.com/settings/tokens with the following permissions:

   - `repo`
   - `read:packages`
   - `read:org`
   - `read:public_key`
   - `read:repo_hook`
   - `user`
   - `read:discussion`
   - `read:enterprise`

1. login using `travis login --pro --github-token <token from github>`

1. For a given `VAR_NAME` that you want to have value `secret_value`, run
   `travis encrypt --pro VAR_NAME=secret_value`
   which will ask for your GitHub username and password and then
   output your encrypted variable

1. Copy the encrypted variable into `.travis.yml`

1. Delete your personal access token from GitHub

# Sensors Admin Server

The Sensors Admin server is used for both **dev** and **prod**.

To ssh onto the `sensors-admin` server

```
ssh brave@sensors-admin.brave.coop
```

The `sudo` password is on 1Password --> ODetect Credentials --> Login - sensors-admin
(cluster management) server.

## Adding public keys to the admin server

Access is restricted to machines whose public key has been added to the server's allowlist.

1. Using an account that can, SSH onto the `sensors-admin` server

1. Paste the user's public key onto a new line on the `~/.ssh/authorized_keys` file from a machine that is already capable of accessing the server

# Interacting with the Managed Database

## Connecting to a database

The PostgreSQL DB connection parameters are required for the application to open a connection to the database. We primarily use the following databases, although you are free to create new ones for development purposes

| Environment | User      | Database Name       |
| ----------- | --------- | ------------------- |
| Production  | doadmin   | backend-replacement |
| Development | bravetest | bravetest           |

To access a database shell

1. Log in to Digital Ocean

1. Navigate to Databases --> odetect-db

1. In the Connection Details box:

   1. In the "Connection parameters" dropdown, select "Flags"

   1. In the "User" dropdown, select the user for your desired deployment environment

   1. In the "Database/Pool" dropdown, select the database name for your desired deployment
      environment, click the 'Copy' button below, and paste the result into your terminal to access the shell

## Adding a new Database migration script

This strategy assumes that each migration script in the `db` directory has a unique positive integer migration ID, and that each script's migration ID is exactly one greater than the previous script's migration ID. Otherwise, the scripts will not run.

1. Copy `db/000-template.sql` and name it with the desired migration ID (padded with zeros) followed by a short description of what it does e.g. `005-newColumn.sql`

2. Update the file with its migration ID and the new migration scripts

## Deploying the migration scripts

1. In the BraveSensor-Server directory, run the following command

   ```

   PG_PORT=<your db's port> PG_HOST=<your db's host> PG_PASSWORD=<your db's password> PG_USER=<your db's user> PG_DATABASE=<your db name> setup_postgresql.sh
   ```

## Viewing which migration scripts have been run and when

1. Copy the "Flag" connection details from Digital Ocean for the DB you want to check

1. Run
   ```postgres
   SELECT *
   FROM migrations
   ORDER BY id;
   ```
# Cluster Migration and Setup

## Setting up networking for a new cluster

Follow [these instructions](https://www.digitalocean.com/community/tutorials/how-to-set-up-an-nginx-ingress-on-digitalocean-kubernetes-using-helm) from digital ocean if you are setting up a new cluster. After installing cert-manager and Nginx Ingress Controller, you can use the `prod_issuer.yaml` and `sensor-ingress.yaml` to set up certificate management and ingress respectively.

## Setting up redis on a new cluster

1. From a shell with kubectl access to the cluster, cd into `BraveSensor-Server` repository and run `kubectl apply -f manifests/redis_storage.yaml`
2. Install redis from the bitnami/redis chart by running `helm install <environment name>-sensor-redis bitnami/redis --namespace redis --set persistence.storageClass=redis-storage --set usePassword=false --set cluster.enabled=false`
3. Run `kubectl get svc --namespace=redis` to get the IP of your new redis instance to use as an environment variable