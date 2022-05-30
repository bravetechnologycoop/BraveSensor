# BraveSensor

[![Build Status](https://travis-ci.com/bravetechnologycoop/BraveSensor.svg?branch=main)](https://travis-ci.com/bravetechnologycoop/BraveSensor)

# How to release a new version of BraveSensor Server and Firmware

## 1. Update git to reflect the new release

1. on your local machine, in the `BraveSensor` repository:

   1. pull the latest code ready for release: `git checkout main && git pull origin main`

   1. decide on an appropriate version number for the new version

   1. update `CHANGELOG.md` by moving everything in `Unreleased` to a section for the new version

   1. `cd` into the `~/BraveSensor/server/sensor-helm-chart` directory

      1. Update `Chart.yaml` with a new `version` and new `appVersion`, if applicable

      1. Run `git log -1 --format=%h` to get the container image tag

      1. Update `values.yaml` by putting the tag of your new container image in the `tag` field of `image`

   1. update `BRAVE_FIRMWARE_VERSION` in all `BraveSensorProductionFirmware.ino` files to the new version (versioning scheme described in `firmware/README.md#firmware-versioning`)

   1. make a new commit directly on `main` which updates the changelog, helm chart, and `.ino` files

   1. tag the new commit - for example, if the version number is v1.0.0, use `git tag v1.0.0`

   1. push the new version to GitHub: `git push origin main --tags`

   1. update the `production` branch: `git checkout production && git merge main && git push origin production`

## 2. Update the Staging database

If your changes involve changes to the database schema, you'll need to run your database migration script on the appropriate database for your environment. See the [Database Migration section](#adding-a-new-database-migration-script).

## 3. Update the Staging secrets

We deploy BraveSensor onto a [Kubernetes](https://kubernetes.io/docs/home/) cluster as our production environment. On the cluster, environment variables are handled within `secret` resources. You can access the list of secrets on the cluster by running the command:

`kubectl get secrets`

To view the currently deployed value of an enviornment variable:

`kubectl exec deploy/production-sensor-server -- printenv | grep <environment-variable-name>`

### Creating a secret from a .env file

To create a secret from a .env file, first delete the old secret (don't worry, this won't affect the currently deployed version):

`kubectl delete secret <your-secret-name>`

then create it from the correct `.env` file (for example, on the Sensors Admin server, `~/.env.staging` is the file to use for the Staging secret)

`kubectl create secret generic <your-secret-name> --from-env-file=<path-to-env-file>`

## 4. Deploy and run the smoke tests on Staging

We use [helm](https://helm.sh/docs/) to manage our deployments. Helm allows us to deploy different instances of the application corresponding to dev, staging, and production environments as different 'releases'. Before updating production, we run smoke tests to verify that there's nothing obviously wrong with a release candidate.

1. Run `ssh brave@sensors-admin.brave.coop`

1. cd into the `~/BraveSensor/server` directory and run `git checkout production && git pull origin production` to get the latest version of the helm chart

1. Run the command `helm upgrade staging --set secretName=sensor-staging ~/BraveSensor/server/sensor-helm-chart` to deploy the latest version to staging

1. Run the smoke test script as described [below](#running-smoke-tests-on-the-kubernetes-cluster)

1. Verify that the deployment shows the expected behavior before proceeding

## 5. Deploy the firmware changes and run a test on the BetaTest Borons

1. on your local machine, open Visual Studio Code in the `firmware/boron-ins-fsm` directory and open the Particle Workbench extension

1. run `git checkout production && git pull origin production` to get the latest version of the the code

1. click Target --> "Configure for device" and type `3.3.0` to choose the OS and then `boron` to choose the device

1. click Compile --> "Local Compile"

1. copy the generated `/target/3.3.0/boron/boron-ins-fsm.bin` file somewhere to keep for reference. Rename to `v<version number>_dev.bin` (for example `v50100_dev.bin`)

1. in your browser navigate to Particle Console --> Sandbox --> BetaTest Borons --> Firmware

   1. Upload the firmware: Click "Upload", fill in the following, and click "Upload":

      - Version number = <version number>

      - Title = v<version number> <envrionment>

      - Description - <leave blank>

      - Drag and drop or upload the generated `.bin` file

1. Go to Devices

   1. open a device that is online and click "Edit"

   1. In the firmware dropdown, select the newly uploaded firmware, check the box "Flash now", and click "Save"

1. Go back to Firmware

   1. Hover over your new version, click on "Release firmware", fill in the following, and click "Next"

      1. Release target = "Product default" to deploy to all Beta Borons

      1. Select "Intelligent"

   1. Read, verify, check the box, and click "Release this firmware"

1. Trigger a test alert using a real BetaTest Boron device

## 6. Update production server

1. If you determined that this deployment's changes require downtime:

   1. Send a notification to all the responder phones informing them of the downtime. For example: "Notice: Your Brave Sensor System is down for maintenance. During this time, you may not receive bathroom alerts. You will receive another text message when everything is back online. Thank you for your patience. Have a nice day!"

   1. Take the production server offline `helm uninstall production`

1. Update the production DB and secrets, as necessary

1. If the deployment's changes did _not_ require downtime,

   1. run the command `helm upgrade production ~/BraveSensor/server/sensor-helm-chart`.

   Otherwise

   1. run the command `helm install production ~/BraveSensor/server/sensor-helm-chart`.

   1. Send a notification to all the responder phones informing them that everything is back online. For example: "Notice: Your Brave Sensor System is now back online and functioning normally. Thank you!"

## 7. Update production firmware

1. on your local machine, open Visual Studio Code in the `firmware/boron-ins-fsm` directory and open the Particle Workbench extension

1. run `git checkout production && git pull origin production` to get the latest version of the the code

1. in `BraveSensorProductionFirmware.ino`, change `BRAVE_PRODUCT_ID` to the ID of the "Production Sensor Devices" project (`15479`) [NOTE: do NOT commit this change]

1. click Target --> "Configure for device" and type `3.3.0` to choose the OS and then `boron` to choose the device

1. click Compile --> "Local Compile"

1. copy the generated `/target/3.3.0/boron/boron-ins-fsm.bin` file somewhere to keep for reference. Rename to `v<version number>_production.bin` (for example `v50100_production.bin`)

1. in your browser navigate to Particle Console --> Brave Technology Coop --> Production Sensor Devices --> Firmware

   1. Upload the firmware: Click "Upload", fill in the following, and click "Upload":

      - Version number = <version number>

      - Title = v<version number> <envrionment>

      - Description - <leave blank>

      - Drag and drop or upload the generated `.bin` file

1. Go to Devices

   1. open a test device that is online and click "Edit"

   1. In the firmware dropdown, select the newly uploaded firmware, check the box "Flash now", and click "Save"

1. Go back to Firmware

   1. Hover over your new version, click on "Release firmware", fill in the following, and click "Next"

      1. Release target = "Product default" (or a set of groups, if doing a staged rollout) to deploy to all production Borons

      1. Select "Intelligent"

   1. Read, verify, check the box, and click "Release this firmware"

## 8. Celebrate

1. Post a message to the `#sensor-aa-general` Slack channel letting everyone know that the deployment is finished and list the changes in this deployment from the `CHANGELOG`

# Deploying to the staging or development environment

#### To deploy to staging

1. Run `ssh brave@sensors-admin.brave.coop`
1. Run the command `helm install staging --set secretName=sensor-staging --set image.tag=<image tag you want to deploy> ~/BraveSensor/server/sensor-helm-chart`

#### To redeploy to staging

1. Run `ssh brave@sensors-admin.brave.coop`
1. Run the command `helm upgrade staging --set secretName=sensor-staging --set image.tag=<image tag you want to deploy> ~/BraveSensor/server/sensor-helm-chart`

#### To deploy to development

1. Run `ssh brave@sensors-admin.brave.coop`
1. Run the command `helm intsall dev --set secretName=sensor-dev --set image.tag=<image tag you want to deploy> ~/BraveSensor/server/sensor-helm-chart`

#### To redeploy to development

1. Run `ssh brave@sensors-admin.brave.coop`
1. Run the command `helm upgrade dev --set secretName=sensor-dev --set image.tag=<image tag you want to deploy> ~/BraveSensor/server/sensor-helm-chart`

# Buliding and pushing containers to the Container Registry

Our Docker containers are stored on a Digital Ocean Container Registry. Every time Travis finishes the `push container` job, a container (with that code named with the first 7 digits of the git hash) will be available in the registry. When deploying to production, we always want to use one of these Travis-generated versions.

## Build and push a new container manually

Sometimes during development and debugging, it is useful to build and push new container images manually because this is much faster than waiting for Travis. Containers generated this way should not be used in production deployments.

1. Install Docker locally (https://docs.docker.com/get-docker/ and, if you are running Linux,
   https://docs.docker.com/engine/install/linux-postinstall/)

1. Install and configure `doctl` with your API token (https://www.digitalocean.com/docs/apis-clis/doctl/how-to/install/)

1. Build the Docker image, tag it, and push it to the registry by running

   ```
   ./build.sh
   ```

# Running Smoke Tests on the Kubernetes Cluster

Once a build is deployed to the cluster, you can test basic aspects of its functionality by running the `smoketest.js` script on your local machine in the `BraveSensor/server` directory. The script takes three parameters, a url for a deployment, a recipient phone number, and a Twilio number.:

    `npm run smoketest <server url> <your phone number> <valid Twilio number>`

The twilio number must have its SMS webhook pointing at the server you're running the smoketest on. So, for example, if I wanted to run the smoke test on Staging with +17781234567 as the recipient phone number, and I knew +17786083684 was a valid twilio number pointing to the Staging server, I could run the following command:

    `npm run smoketest 'https://staging.sensors.brave.coop' '+17781234567' '+17786083684'`

The script will take a few minutes to conclude. The expected behavior is for a location to be created, and a session which results from a 'Stillness' alert to the phone number provided for a XeThru + Server-side State Machine sensor and then a second time for an INS + Firmware State Machine sensor.

You can get further details about the behaviour of the build by watching logs for the application with:
`kubectl logs -f --timestamps deploy/<env>-sensor-server`
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

For local development, we use `.env` files to set environment variables. To set one of these up, copy the `.env.example` and rename it to `.env`, and fill in the values as appropriate.

### Altering a secret's schema

If there are changes to the schema of the environment variables (like the addition or deletion of a key) this change must be reflected in the env variables section of `BraveSensor/server/sensor-helm-chart/templates/sensor-deployment.yaml`, in addition to changing the Kubernetes secret.

## Database Setup

You will need to populate the `.env` file with connection parameters for both redis and Postgresql. If you are using a local database you will also need to setup the database schema.

To do this, cd into the `BraveSensor/server` directory and run the following command

```
sudo PG_PORT=<your db's port> PG_HOST=<your db's host> PG_PASSWORD=<your db's password> PG_USER=<your db's user> PG_DATABASE=<your db name> ./setup_postgresql_local.sh
```

## Tests

Unit tests are written using the [Mocha](https://mochajs.org/) JS test framework, the [Chai](https://www.chaijs.com/) assertion library, and the [Sinon](https://sinonjs.org/) mocking library.

To run the tests locally:

```
npm ci
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

The Sensors Admin server is used for **dev**, **staging**, and **prod**.

To ssh onto the `sensors-admin` server

```
ssh brave@sensors-admin.brave.coop
```

The `sudo` password is on 1Password --> Brave Sensor Credentials --> Sensors Admin server.

## Adding public keys to the admin server

Access is restricted to machines whose public key has been added to the server's allowlist.

1. Using an account that can, SSH onto the `sensors-admin` server

1. Paste the user's public key onto a new line on the `~/.ssh/authorized_keys` file from a machine that is already capable of accessing the server

## Toublehooting authentication error

If you get the error

`error: You must be logged in to the server (Unauthorized)`

when you try to run any `kubectl` or `helm` commands. It's possible that your `doctl` access token has expired or was deleted. To see if that's the case, in run

`doctl auth init`

You will know that this is the case, if you get a response like this:

```
Using token [<long token here>]

Validating token... invalid token

Error: Unable to use supplied token to access API: GET https://api.digitalocean.com/v2/account: 401 (request "<guid>") Unable to authenticate you
```

To fix this problem:

1. Create a new token following the instructions here: https://docs.digitalocean.com/reference/api/create-personal-access-token/

2. On the Sensors Admin Server, run the command

   `doctl auth init --access-token <new access token>`

3. Open up the Cluster in Digital Ocean and navigate to Step 2 of the Getting Started Guide (https://cloud.digitalocean.com/kubernetes/clusters/565044a4-6b9d-4f08-859b-c42a6272a038?showGettingStarted=true&i=c5171f). Copy and paste the "Automated" command that looks like

   `doctl kubernetes cluster kubeconfig save <guid>`

4. Run that command on the Sensors Admin Server

# Interacting with the Managed Database

## Connecting to a database

The PostgreSQL DB connection parameters are required for the application to open a connection to the database. We primarily use the following databases, although you are free to create new ones for development purposes

| Environment | User      | Database Name       |
| ----------- | --------- | ------------------- |
| Production  | doadmin   | backend-replacement |
| Staging     | bravetest | staging             |
| Development | bravetest | bravetest           |

To access a database shell

1. Log in to Digital Ocean

1. Navigate to Databases --> `odetect-db-jul-22-backup`

1. In the Connection Details box:

   1. In the "Connection parameters" dropdown, select "Flags"

   1. In the "User" dropdown, select the user for your desired deployment environment

   1. In the "Database/Pool" dropdown, select the database name for your desired deployment
      environment, click the 'Copy' button below, and paste the result into your terminal to access the shell

## Adding a new Database migration script

This strategy assumes that each migration script in the `db` directory has a unique positive integer migration ID, and that each script's migration ID is exactly one greater than the previous script's migration ID. Otherwise, the scripts will not run.

1. Copy `db/000-template.sql` and name it with the desired migration ID (padded with zeros) followed by a short description of what it does e.g. `005-newColumn.sql`

2. Update the file with its migration ID by replacing `ADD MIGRATION ID HERE` and the new migration scripts by adding it to the section `-- ADD SCRIPT HERE`.

3. Update the `setup_postgresql.sh` file to include the newly-created `.sql` file at the bottom

## Deploying the migration scripts

1. In the `BraveSensor/server` directory, run the following command

   ```
   PG_PORT=<your db's port> PG_HOST=<your db's host> PG_PASSWORD=<your db's password> PG_USER=<your db's user> PG_DATABASE=<your db name> ./setup_postgresql.sh
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

1. From a shell with kubectl access to the cluster, cd into `BraveSensor/server` repository and run `kubectl apply -f manifests/redis_storage.yaml`
2. Install redis from the bitnami/redis chart by running `helm install <environment name>-sensor-redis bitnami/redis --namespace redis --set persistence.storageClass=redis-storage --set usePassword=false --set cluster.enabled=false`
3. Run `kubectl get svc --namespace=redis` to get the IP of your new redis instance to use as an environment variable

# Particle API access

The Brave Siren functions used the Particle API to trigger the Siren when a `DURATION` or `STILLNESS` event occurs. This requires the access token (`PARTICLE_ACCESS_TOKEN`) for an API user with permission to call functions in the product group (`PARTICLE_PRODUCT_GROUP`). This may be useful again in the future for interacting with Particle.

To generate this token:

1. Generate an access token for dev@brave.coop (https://docs.particle.io/reference/device-cloud/api/#generate-an-access-token)

   ```
   curl https://api.particle.io/oauth/token -u particle:particle -d grant_type=password -d "username=dev@brave.coop" -d "password=<get from 1Password>"
   ```

1. Create a _new_ API user (https://docs.particle.io/reference/device-cloud/api/#creating-an-api-user) that is allowed to call functions in the given product group. Find the product group in the Particle Console - it should match the value in the `PARTICLE_PRODUCT_GROUP` environment variable (https://docs.particle.io/reference/SDKs/javascript/#product-support). Use a different `friendly_name` than the previous API user, which we will delete later.

   ```
   curl "https://api.particle.io/v1/products/<product group slug or ID>?access_token=<access_token returned in step 1>" -H "Content-Type: application/json" -d '{ "friendly_name": "<new api user name>", "scopes": [ "devices.function:call" ]}'
   ```

1. Set the `PARTICLE_ACCESS_TOKEN` environment variable to the `token` returned by the API call in the previous step

1. _AFTER_ the updated environment variable is deployed to all environments, delete the _old_ API user (https://docs.particle.io/reference/device-cloud/api/#deleting-an-api-user). Note that the username of the old API user can be found in the Particle Console: https://console.particle.io/orgs/brave-technology-coop/team under "API Users"

   ```
   curl -X DELETE "https://api.particle.io/v1/orgs/brave-technology-coop/team/<username of OLD api user>?access_token=<access_token returned in step 1>"
   ```

1. Delete the access token for dev@brave.coop that you created in the first step (https://docs.particle.io/reference/device-cloud/api/#delete-current-access-token) so that it cannot be used for any nefarious purposes.

   ```
   curl -X DELETE "https://api.particle.io/v1/access_tokens/current?access_token=<access_token returned in step 1>"
   ```
