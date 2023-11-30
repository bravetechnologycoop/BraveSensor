# BraveSensor

[![Build Status](https://travis-ci.com/bravetechnologycoop/BraveSensor.svg?branch=main)](https://travis-ci.com/bravetechnologycoop/BraveSensor)

# Table of Contents

1. [Production Deployment](#production-deployment)
   - [(Staging Deployment)](#3-deploy-the-server-and-run-the-smoke-tests-on-staging)
1. [Dev Deployment](#dev-deployment)
1. [Server smoke tests](#server-smoke-tests)
1. [Dashboard](#dashboard)
1. [Logs](#logs)
1. [Database](#database)
1. [Local development](#local-development)
1. [Travis](#travis)
1. [Particle API Access](#particle-api-access)
1. [Troubleshooting](#troubleshooting)

# Production Deployment

## 1. Update git to reflect the new release

1. Check the deployment ClickUp Task for any comments or SubTasks that could affect these deployment steps

1. Send a message to the `#sensor-aa-general` Slack channel letting everyone know that you are doing a deployment

1. On your local machine, in the `BraveSensor` repository:

   1. Pull the latest code ready for release: `git checkout main && git pull origin main`

   1. Decide on an appropriate version number for the new version

   1. Update `CHANGELOG.md`

      1. Add a new section header with the new version number and the current date below the `[Unreleased]` link so it will look like this: `[new version number] - YYYY-MM-DD`

      1. Create a new link for the new version near the bottom of the file that looks like this: `[new version number>]: https://github.com/bravetechnologycoop/BraveSensor/compare/v[previous version number]...v[new version number]`

      1. Update the `[unreleased]` link to `[unreleased]: https://github.com/bravetechnologycoop/BraveSensor/compare/v[new version number]...HEAD`

   1. Update `BRAVE_FIRMWARE_VERSION` in all `BraveSensorProductionFirmware.ino` files to the new version (versioning scheme described in `firmware/README.md#firmware-versioning`)

   1. Make a new commit directly on `main` which updates the CHANGELOG and the `.ino` files with the commit message "Release v[version number]"

   1. Tag the new commit - for example, if the version number is v1.0.0, use `git tag v1.0.0`

   1. Push the new version to GitHub: `git push origin main --tags`

   1. Update the `production` branch: `git checkout production && git merge main && git push origin production`

## 2. Update the Environment Variables in Staging and Production

1. On your local machine, in the `BraveSensor-DevOps` repository:

   1. Pull the latest code for release: `git checkout main && git pull origin main`

   1. Edit the Staging environment variables, if needed: `ansible-vault edit --ask-vault-pass environments/ssm_parameters/staging.tf`

   1. Edit the Production environment variables, if needed: `ansible-vault edit --ask-vault-pass environments/ssm_parameters/production.tf`

   1. Commit changes

   1. Tag the new commit - for example, if the version number is v1.0.0, use `git tag v1.0.0`

   1. Push the new version to GitHub: `git push origin main --tags`

1. Send the changes to AWS Parameter Store

   1. Go to the "Update Environment Variables" action on [GitHub Actions](https://github.com/bravetechnologycoop/BraveSensor-DevOps/actions/workflows/update-env-vars.yml)

   1. Click "Run workflow"

   1. Select the `main` branch

   1. Select the `STAGING` environment

   1. Click "Run workflow"

1. Repeat for the `PRODUCTION` environment

1. Wait until both Actions have completed successfully

## 3. Deploy the server and run the smoke tests on Staging

Before updating Production, we deploy the server to Staging and run the smoke tests to verify that there's nothing obviously wrong with the release candidate.

1. Go to the "Deploy AWS Staging" action on [GitHub Actions](https://github.com/bravetechnologycoop/BraveSensor/actions/workflows/deploy-staging.yml)

1. Click "Run workflow", select the `production` branch, and click "Run workflow"

1. Wait for it to complete successfully

1. On your local machine in the `server` directory, update the `PARTICLE_WEBHOOK_API_KEY` in `.env` to the value in Staging

1. On your local machine in the `server` directory, run the smoke test script: `npm run smoketest 'https://api.staging.bravecoopservices.com' '[your phone number]' '+17787620179'`

1. Verify that the deployment shows the expected behavior before proceeding

## 4. Deploy the firmware changes and run a test on the BetaTest Borons

1. On your local machine, open Visual Studio Code in the `firmware/boron-ins-fsm` directory and open the Particle Workbench extension

1. If you haven't already, run `git checkout production && git pull origin production` to get the latest version of the the code

1. Click Target --> "Configure for device" and type `3.3.1` to choose the OS and then `boron` to choose the device

1. Click Compile --> "Local Compile" (this step can take a few minutes the first time; you can work on the next step in parallel while you wait for this)

1. Copy the generated `/target/3.3.1/boron/boron-ins-fsm.bin` file to [Google Drive](https://drive.google.com/drive/u/0/folders/1QVvBvGM3MP9VU5-8AVG3Nf0KddeE5_uz) for future reference. Rename to `v[version number]_dev.bin` (for example `v5010_dev.bin`)

1. In your browser navigate to Particle Console --> Sandbox --> BetaTest Borons --> Firmware

   1. Upload the firmware: Click "Upload", fill in the following, and click "Upload":

      - Version number = [version number]

      - Title = v[version number] [environment]

      - Description - [leave blank]

      - Drag and drop or upload the generated `.bin` file

1. Go to Devices

   1. Open a device that is online and click "Edit"

   1. In the firmware dropdown, select the newly uploaded firmware, check the box "Flash now", and click "Save"

   1. After you see the Boron receive the `spark/flash/status` `success` message, force the Boron to restart by sending "1" to the `Force_Reset` cloud function to start using the latest firmware. Note that this will produce an error, this is expected, please ignore.

   1. Trigger a test alert using the BetaTest Boron device with the new firmware

1. Go back to Firmware

   1. Hover over your new version, click on "Release firmware", fill in the following, and click "Next"

      1. Release target = "Product default" to deploy to all Beta Borons

      1. Select "Intelligent"

   1. Read, verify, check the box, and click "Release this firmware"


## 5. Deploy the server on Production

1. Go to the "Deploy AWS Production" action on [GitHub Actions](https://github.com/bravetechnologycoop/BraveSensor/actions/workflows/deploy-production.yml)

1. Click "run workflow", select the `production` branch, and click "Run workflow"

1. Wait for it to complete successfully

## 6. Deploy the firmware on Production

1. On your local machine, open Visual Studio Code in the `firmware/boron-ins-fsm` directory and open the Particle Workbench extension

1. If you haven't already, run `git checkout production && git pull origin production` to get the latest version of the the code

1. In `BraveSensorProductionFirmware.ino`, change `BRAVE_PRODUCT_ID` to the ID of the "Production Sensor Devices" project (`15479`) [NOTE: do NOT commit this change]

1. If you haven't already, click Target --> "Configure for device" and type `3.3.1` to choose the OS and then `boron` to choose the device

1. If you haven't already, click Compile --> "Local Compile" (this step can take a few minutes the first time; you can work on the next step in parallel while you wait for this)

1. Copy the generated `/target/3.3.1/boron/boron-ins-fsm.bin` file to [Google Drive](https://drive.google.com/drive/u/0/folders/1QVvBvGM3MP9VU5-8AVG3Nf0KddeE5_uz) for future reference. Rename to `v[version number]_production.bin` (for example `v5010_production.bin`)

1. In your browser navigate to Particle Console --> Brave Technology Coop --> Production Sensor Devices --> Firmware

   1. Upload the firmware: Click "Upload", fill in the following, and click "Upload":

      - Version number = [version number]

      - Title = v[version number] [environment]

      - Description - [leave blank]

      - Drag and drop or upload the generated `.bin` file

1. Go to Devices

   1. Open a test device that is online (preferrably one that you know isn't being used right now) and click "Edit"

   1. In the firmware dropdown, select the newly uploaded firmware, check the box "Flash now", and click "Save"

   1. After you see the Boron receive the `spark/flash/status` `success` message, force the Boron to restart by sending "1" to the `Force_Reset` cloud function to start using the latest firmware. Note that this will produce an error, this is expected, please ignore.

1. Go back to Firmware

   1. Hover over your new version, click on "Release firmware", fill in the following, and click "Next"

      1. Release target = "Product default" (or a set of groups, if doing a staged rollout) to deploy to all production Borons

      1. Select "Intelligent"

   1. Read, verify, check the box, and click "Release this firmware"

## 7. Verify

1. Verify that the production Dashboard is working: https://api.production.bravecoopservices.com/

1. Verify that the logs look reasonable

   1. Login to AWS SSO --> AWS Accounts --> Brave Devices Production --> SSM_CW_Logs_RO --> Management console

   1. Navigate to CloudWatch --> Logs --> Log groups --> brave-devices-production-api

   1. Choose the most recent log stream, look at the logs, and optionally "Start tailing" them

## 8. Celebrate

1. Post a message to the `#sensor-aa-general` Slack channel letting everyone know that the deployment is finished and list the changes in this deployment from the `CHANGELOG`

1. Update the ClickUp Tasks

1. If appropriate, send a Feature Change Announcement email to the clients

# Dev Deployment

## How to update the Environment Variables in Development

1. On your local machine, in the `BraveSensor-DevOps` repository:

   1. Pull the latest code for release: `git checkout main && git pull origin main`

   1. Edit the Development environment variables, if needed: `ansible-vault edit --ask-vault-pass environments/ssm_parameters/development.tf`

   1. Commit changes

   1. Push the new version to GitHub: `git push origin main`

1. Send the changes to AWS Parameter Store

   1. Go to the "Update Environment Variables" action on [GitHub Actions](https://github.com/bravetechnologycoop/BraveSensor-DevOps/actions/workflows/update-env-vars.yml)

   1. Click "Run workflow"

   1. Select the `main` branch

   1. Select the `DEVELOPMENT` environment

   1. Click "Run workflow"

1. Wait until the Action has completed successfully

1. Deploy the server on Development (note that your environment variable changes will not take effect until the server is deployed)

## How to deploy the Server on Development

1. Go to the "Deploy AWS Development" action on [GitHub Actions](https://github.com/bravetechnologycoop/BraveSensor/actions/workflows/deploy-development.yml)

1. Click "run workflow", select the branch to deploy, and click "Run workflow"

## How to deploy the Firwmare on Development

1. On your local machine, open Visual Studio Code in the `firmware/boron-ins-fsm` directory and open the Particle Workbench extension

1. In `BraveSensorProductionFirmware.ino`, change `BRAVE_FIRMWARE_VERSION` to an unused version number less than `7000` [NOTE: do NOT commit this change]

1. Click Target --> "Configure for device" and type `3.3.1` to choose the OS and then `boron` to choose the device

1. Click Compile --> "Local Compile"

1. In your browser navigate to Particle Console --> Sandbox --> BetaTest Borons --> Firmware

   1. Upload the firmware: Click "Upload", fill in the following, and click "Upload":

      - Version number = [version number]

      - Title = v[version number] [environment]

      - Description - [leave blank]

      - Drag and drop or upload the generated `/target/3.3.1/boron/boron-ins-fsm.bin` file

1. Go to Devices

   1. Open the device that you'd like to deploy to and click "Edit"

   1. In the firmware dropdown, select the newly uploaded firmware, check the box "Flash now", and click "Save"

   1. After you see the Boron receive the `spark/flash/status` `success` message, force the Boron to restart by sending "1" to the `Force_Reset` cloud function to start using the latest firmware. Note that this will produce an error, this is expected, please ignore.

# Taking the Dev, Staging, or Production server offline

By default, our servers never go offline. Even during a deployment, they do so in a way that should have zero downtime. However, there may be situations where we really want to turn them offline. In these cases, we scale them to zero instances.

1. Login to the `Brave Devices [environment]` AWS Account using your SSO login
1. Switch to the "Canada (Central)" region
1. Navigate to Elastic Container Service --> Clusters --> `brave-devices-[environment]-cluster` --> `brave-devices-[environment]-api`
1. Click "Update Service"
1. Change the value of "Desired tasks" to `0`
1. Click "Update"

To bring it back online, do the same thing but set the "Desired tasks" to 1.

Note that it would be nice to have more than one task in production. However, when we tried this, we were unable to login to the Dashboard. So more experimenting is required before we can set this value to anything higher than one.

# Server smoke tests

Once a build is deployed, you can test basic aspects of its functionality by running the `smoketest.js` script on your local machine in the `BraveSensor/server` directory. The script takes three parameters, a url for a deployment, a recipient phone number, and a Twilio number.:

```
npm run smoketest [server url] [your phone number] [valid Twilio number]
```

The twilio number must have its SMS webhook pointing at the server you're running the smoketest on. So, for example, if I wanted to run the smoke test on Staging with +17781234567 as the recipient phone number, and I knew +17787620179 was a valid twilio number pointing to the Staging server, I could run the following command:

```
 npm run smoketest 'https://api.staging.bravecoopservices.com' '+17781234567' '+17787620179'
```

or on development:

```
npm run smoketest 'https://api.development.bravecoopservices.com' '+17781234567' '+16042008122'
```

The script will take a few minutes to conclude. The expected behavior is for a location to be created, and a session which results from a 'Stillness' alert to the phone number provided.

You can get further details about the behaviour of the build by watching logs for the application on AWS CloudWatch.

# Dashboard

## How to login to the Development, Staging, and Production Dashboards

1. Get the current username and password from AWS Parameter Store

   1. Login to the `Brave Devices [environment]` AWS Account using your SSO login
   1. Switch to the "Canada (Central)" region
   1. Navigate to AWS System Manager --> Parameter Store
   1. The username is the value of `/brave/sensors-api/[environment]/web-app/web_username` and the password is the value of `/brave/sensors-api/[environment]/web-app/password`

1. Navigate to `https://api.[environment].bravecoopservices.com/` in a browser and login

## How to run and login to your local Dashboard

1. Navigate to the server directory

1. Run `npm ci`

1. Run `npm start`

1. Get the current username (`WEB_USERNAME`) and password (`PASSWORD`) from your `.env` file

1. Navigate to `http://localhost:8000` in a browser and login

# Logs

## How to view the server logs on Development, Staging, and Production

1. Login to the `Brave Devices [environment]` AWS Account using your SSO login
1. Switch to the "Canada (Central)" region
1. Navigate to Cloud Watch --> Logs --> Log groups --> brave-devices-[environment]-api
1. Click on the most recent log stream
1. Click on "Start Tailing"

# Database

## Connecting to the Development, Staging, or Production database

The development, staging, and production databases live on AWS and are only accessible through a VPN. We use TailScale, which can be downloaded [here](https://tailscale.com/download).

This is implemented by a small EC2 instance in the DevOps Central AWS account.

1. Login to Tailscale on your local machine:

   1. Run `sudo tailscale login --accept-routes`
   1. Navigate to the resulting link
   1. Login using the Brave Google account for brave.devices.tailscale@gmail.com (credentials are in 1Password --> Brave Sensors Credentials --> Tailscale (VPN for accessing Brave Sensors DB))
   1. Connect the device

1. Connect to the database:

   1. Get the current username and password from AWS Parameter Store
      1. Login to the `Brave Devices [environment]` AWS Account using your SSO login
      1. Switch to the "Canada (Central)" region
      1. Navigate to AWS System Manager --> Parameter Store
      1. Get the values:
         - password = `/brave/sensors-api/[environment]/pg/pg_password`
         - host = `/brave/sensors-api/[environment]/pg/pg_host`
         - port = `/brave/sensors-api/[environment]/pg/pg_port`
         - database = `/brave/sensors-api/[environment]/pg/pg_database`
         - username = `/brave/sensors-api/[environment]/pg/pg_user`
   1. Run `PGPASSWORD=[password] psql -h [host] -p [port] -d [database] -U [username]`

## Adding a new Database migration script

This strategy assumes that each migration script in the `db` directory has a unique positive integer migration ID, and that each script's migration ID is exactly one greater than the previous script's migration ID. Otherwise, the scripts will not run.

1. Copy `db/000-template` and name it with the desired migration ID (padded with zeros) followed by a short description of what it does e.g. `005-newColumn.sql`

2. Update the file with its migration ID by replacing `ADD MIGRATION ID HERE` and the new migration scripts by adding it to the section `-- ADD SCRIPT HERE`

## Viewing which migration scripts have been run and when

1. Run
   ```postgres
   SELECT *
   FROM migrations
   ORDER BY id;
   ```

# Local Development

## Dependencies

1. Download and install [PostgreSQL version 12](https://www.postgresql.org/download/)

Alternately, you have the option of installing these dependencies as docker containers

1. PostgreSQL: https://hub.docker.com/_/postgres

## Environment Variables

For local development, we use `.env` files to set environment variables. To set one of these up, copy the `.env.example` and rename it to `.env`, and fill in the values as appropriate.

## Local Database

You will need to populate the `.env` file with connection parameters for Postgresql. If you are using a local database you will also need to setup the database schema.

To do this, cd into the `BraveSensor/server` directory and run the following command

```
sudo PG_PORT=[your db's port] PG_HOST=[your db's host] PG_PASSWORD=[your db's password] PG_USER=[your db's user] PG_DATABASE=[your db name] ./setup_postgresql_local.sh
```

## Tests

Unit tests are written using the [Mocha](https://mochajs.org/) JS test framework, the [Chai](https://www.chaijs.com/) assertion library, and the [Sinon](https://sinonjs.org/) mocking library.

To run the tests locally:

```
npm ci
npm run test
```

The tests run automatically on Travis on every push to GitHub and every time a pull request is created.

# Travis

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

1. login using `travis login --pro --github-token [token from github]`

1. For a given `VAR_NAME` that you want to have value `secret_value`, run
   `travis encrypt --pro VAR_NAME=secret_value`
   which will ask for your GitHub username and password and then
   output your encrypted variable

1. Copy the encrypted variable into `.travis.yml`

1. Delete your personal access token from GitHub

# Particle API access

The Brave Siren functions used the Particle API to trigger the Siren when a `DURATION` or `STILLNESS` event occurs. This requires the access token (`PARTICLE_ACCESS_TOKEN`) for an API user with permission to call functions in the product group (`PARTICLE_PRODUCT_GROUP`). This may be useful again in the future for interacting with Particle.

To generate this token:

1. Generate an access token for dev@brave.coop (https://docs.particle.io/reference/device-cloud/api/#generate-an-access-token)

   ```
   curl https://api.particle.io/oauth/token -u particle:particle -d grant_type=password -d "username=dev@brave.coop" -d "password=[get from 1Password]"
   ```

1. Create a _new_ API user (https://docs.particle.io/reference/device-cloud/api/#creating-an-api-user) that is allowed to call functions in the given product group. Find the product group in the Particle Console - it should match the value in the `PARTICLE_PRODUCT_GROUP` environment variable (https://docs.particle.io/reference/SDKs/javascript/#product-support). Use a different `friendly_name` than the previous API user, which we will delete later.

   ```
   curl "https://api.particle.io/v1/products/[product group slug or ID]?access_token=[access_token returned in step 1]" -H "Content-Type: application/json" -d '{ "friendly_name": "[new api user name]", "scopes": [ "devices.function:call" ]}'
   ```

1. Set the `PARTICLE_ACCESS_TOKEN` environment variable to the `token` returned by the API call in the previous step

1. _AFTER_ the updated environment variable is deployed to all environments, delete the _old_ API user (https://docs.particle.io/reference/device-cloud/api/#deleting-an-api-user). Note that the username of the old API user can be found in the Particle Console: https://console.particle.io/orgs/brave-technology-coop/team under "API Users"

   ```
   curl -X DELETE "https://api.particle.io/v1/orgs/brave-technology-coop/team/[username of OLD api user]?access_token=[access_token returned in step 1]"
   ```

1. Delete the access token for dev@brave.coop that you created in the first step (https://docs.particle.io/reference/device-cloud/api/#delete-current-access-token) so that it cannot be used for any nefarious purposes.

   ```
   curl -X DELETE "https://api.particle.io/v1/access_tokens/current?access_token=[access_token returned in step 1]"
   ```

# Troubleshooting

## Tailscale

If the "Update Environment Variables" GitHub Action fails due to TailScale authentication, this is because the TailScale API key needs to be updated every 3 months. This can be done in AWS.

# // TODO add section on viewing environment variables
