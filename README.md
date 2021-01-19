# BraveSensor-Server

[![Build Status](https://travis-ci.com/bravetechnologycoop/BraveSensor-Server.svg?branch=master)](https://travis-ci.com/bravetechnologycoop/BraveSensor-Server)


# Local Development

## Tests

Unit tests are written using the [Mocha](https://mochajs.org/) JS test framework
and the [Chai](https://www.chaijs.com/) assertion library.

To run the tests locally:
```
npm install
npm run test
```

The tests run automatically on Travis on every push to GitHub and every time a pull request is created.


# Dev or Prod Deployment

## Before building a Docker image

Before deployment of a new Docker container to the Kubernetes cluster, check that all the following are in place:

### Smartthings Public Key

The Samsung Smartthings Smartapp requires a public key to work. 

These steps need to be re-run anytime you change target deployment environment.

1. Copy public key from the "ODetect Credentials" vault in 1Password into your local
`BraveSensor-Server/smartthings_rsa.pub` file

   - If you are deploying to **dev**, copy the value of `Dev - BraveSensor SmartThings Automation Public Key`

   - If you are deploying to **prod**, copy the value of `Prod - BraveSensor2 SmartThings Automation Public Key`


### .env files

The .env file contain important secrets such as Twilio credentials, Postgres credentials as well as the IP address of the Env files for the production and development deployments. 

These steps need to be re-run anytime the `.env` file changes.

1. Copy from the "ODetect Credentials" vault in 1Password into your local 
`BraveSensor-Server/.env` file

   - If you are deploying to **dev**, copy the value of "Dev - env file"

   - If you are deploying to **prod**, copy the value of "Prod - env file"


### Redis cluster IP

The cluster IP of the redis deployment is a required parameter for the node application to open a connection to the database. 

These steps need to be re-run anytime the Redis deployment changes.

1. To obtain this cluster IP, first confirm that the necessary deployment is running on the kubernetes cluster.

    1. SSH into the `odetect-admin` server (see [here](#access-odetect-admin-server))

    1. Run
    ```
    kubectl get services
    ```

1. If there is no redis deployment for the environment you are trying to deploy to, 
create a new deployment from a manifest by

    1. Checkout the desired git branch (`devenv` for **dev**, `master` for **prod**) to the
    `odetect-admin` server

    1. Within the `odetect-admin` server, navigate to `~/ODetect-BackendLocal/manifests`

        - If you are deploying to **dev**, run 
            ```
            kubectl apply -f redis-deployment-dev.yaml
            ```

        - If you are deploying to **prod**, run 
            ```
            kubectl apply -f redis-deployment.yaml
            ```

1. If there already is a redis deployment for the environment you are trying to deploy to(`redis-dev` for **dev** or `redis-master` for **prod**), copy the value in its `CLUSTER-IP` colmnn 
into the `REDIS_CLUSTER_IP` field in your local `BraveSensor-Server/.env` file

### DB connection string

The PostgreSQL DB connection string is required for the application to open a connection to
the database.

| Environment           | User    | Database Name       |
|-----------------------|---------|---------------------|
| Production (**prod**) | doadmin | backend-replacement |
| Development (**dev**) | doadmin | development         |

These steps need to be re-run anything the database changes.

1. Log in to Digital Ocean

1. Navigate to Databases --> odetect-db

1. In the Connection Details box:

    1. In the "Connection parameters" dropdown, select "Connection string"

    1. In the "User" dropdown, select the user for your desired deployment environment

    1. In the "Database/Pool" dropdown, select the database name for your desired deployment
    environment

    1. Click "Copy" to copy the connection string to your clipboard

    1. Paste the connection string into the `PG_CONNECTION_STRING` field in your local `BraveSensor-Server/.env` file


## Building a Docker image and pushing to the registry

To be able to push images to the DO container registry, you will need to be authenticated as a member of our DO ODetect project. 

Docker commands are run locally.

1. Install Docker locally (https://docs.docker.com/get-docker/ and, if you are running Linux,
https://docs.docker.com/engine/install/linux-postinstall/)

1. Install and configure `doctl` with your API token (https://www.digitalocean.com/docs/apis-clis/doctl/how-to/install/)

1. Build the Docker image, tag it, and push it to the registry

    - If you are deploying to **dev**, run
        ```
        ./build_dev.sh
        ```

    - If you are deploying to **prod**, run
        ```
        ./build_prod.sh
        ```


## Deploying a Docker image

Our cluster is not setup to automatically pull the new image and restart. Rather, we do it manually.

1. SSH onto the ODetect Admin Server

1. Alter the kubernetes manifest to reflect the tag you have just pushed to your container registry
    - If you are deploying to **dev**, edit the image field in the odetect-deployment-dev.yaml and run
        ```
        kubectl apply -f odetect-deployment-dev.yaml
        ```

    - If you are deploying to **dev**, edit the image field in the odetect-deployment.yaml and run
        ```
        kubectl apply -f odetect-deployment.yaml
        ```

1. Restart the deployment

    - If you are deploying to **dev**, run
        ```
        kubectl rollout restart deployment/odetect-dev
        ```

    - If you are deploying to **prod**, run
        ```
        kubectl rollout restart deployment/odetect
        ```

# ODetect Admin Server

The ODetect Admin server is used for both **dev** and **prod**.

To ssh onto the `odetect-admin` server
```
ssh brave@odetect-admin.brave.coop
```

The `sudo` password is on 1Password --> ODetect Credentials --> Login - odetect-admin 
(cluster management) server.

## Adding public keys to the admin server

Access is restricted to machines whose public key has been added to the server's allowlist.

1. Using an account that can, SSH onto the `odetect-admin` server

1. Paste the user's public key onto a new line on the `~/.ssh/authorized_keys` file from a machine that is already capable of accessing the server


# Database Migration

## Adding a new Database migration script

This strategy assumes that each migration script in the `db` directory has a unique positive integer migration ID, and that each script's migration ID is exactly one greater than the previous script's migration ID. Otherwise, the scripts will not run.

1. Copy `db/000-template.sql` and name it with the desired migration ID (padded with zeros) followed by a short description of what it does e.g. `005-newColumn.sql`

2. Update the file with its migration ID and the new migration scripts

## Deploying the migration scripts

1. Copy the "Flag" connection details from Digital Ocean for the DB you want to migrate

1. Run
    ```
    <connection details from DO> -f <migration script file to deploy>
    ```

## Viewing which migration scripts have been run and when

1. Copy the "Flag" connection details from Digital Ocean for the DB you want to check

1. Run
    ``` postgres
    SELECT *
    FROM migrations
    ORDER BY id;
    ```


## Useful commands

### Kubernetes

Kubernetes commands are run on the ODetect Admin server.

- Enter a pod's shell
    ```
    kubectl exec -i -t <my-pod>  -- /bin/bash
    ```

- Get and follow logs from a pod
    ```
    kubectl logs <my-pod> -f
    ```
