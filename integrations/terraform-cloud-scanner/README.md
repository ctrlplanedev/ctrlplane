# Docker build and Run

From the root of the repo, run the following command to build and run the
docker image:

```bash
docker build -f integrations/terraform-cloud-scanner/Dockerfile . -tterraform-cloud-scanner:local
```

Ensure that your `.env` file doesn't contain any quotes around the values.

Be sure and set the `CTRLPLANE_API_URL=http://host.docker.internal:3000` in the
env file for testing with docker to not conflict with the local ctrlplane
instance.

To run the container with the environment variables, run the following
command:

```bash
docker run --env-file integrations/terraform-cloud-scanner/.env -itterraform-cloud-scanner:local
```

To stop all containers with the image `terraform-cloud-scanner:local`, run the
following command:

```bash
docker stop $(docker ps | grep "terraform-cloud-scanner:local" | awk '{print$1}' | xargs)
```
