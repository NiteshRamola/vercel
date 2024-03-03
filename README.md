## Overview

This project is designed to streamline the deployment of React projects from a GitHub repository. It consists of three services: `api-service`, `build-service`, and `s3-reverse-proxy`. The `api-service` and `s3-reverse-proxy` are containerized using Docker, and a Docker Compose file is provided to run these services together. Additionally, the `build-service` is deployed on Amazon ECS (Elastic Container Service) and is triggered when the `api-service` makes a specific call.

### Project Functionality

The primary functionality of this project is to accept a GitHub URL of a React project through the `api-service`. Upon receiving the GitHub URL, the `build-service` is triggered on Amazon ECS. This service initiates the build process for the specified React project and provides a deployed URL. The `s3-reverse-proxy` service acts as a reverse proxy, forwarding requests to an S3 bucket to serve the build of the project.

This streamlined process allows users to easily deploy their React projects by providing a GitHub URL, and the project takes care of the necessary build and deployment steps.

## Services

### 1. api-service

The `api-service` is responsible for handling API requests. It is containerized using Docker and can be run using the provided Docker Compose file. This service interacts with the `build-service` and triggers a build process on Amazon ECS.

### 2. build-service

The `build-service` is deployed on Amazon ECS and is designed to handle build processes. It is triggered by the `api-service` when a specific API call is made. This service performs the necessary build actions, such as accepting a GitHub URL of a React project, and responds accordingly.

### 3. s3-reverse-proxy

The `s3-reverse-proxy` service is containerized using Docker. It acts as a reverse proxy, handling requests and forwarding them to an S3 bucket. This service is included in the Docker Compose file to run alongside the `api-service`.

## Tech Stack

- **Node.js, TypeScript, Express.js**: For server-side development and API handling.
- **Prisma, PostgreSQL**: Database access and management.
- **Redis**: In-memory data structure store, used for pub/sub functionality.
- **Socket.IO**: Real-time web socket communication for sending realtime logs of the build to the frontend.
- **Docker**: Containerization for deployment and scalability.

## Docker Compose

A Docker Compose file (`docker-compose.yml`) is provided to simplify the deployment and execution of the `api-service` and `s3-reverse-proxy`. To use the Docker Compose file, follow these steps:

1. Install Docker on your system if not already installed.
2. Navigate to the project directory in the terminal.

3. Duplicate the `.env.example` file in the `api-service` and `s3-reverse-proxy` directories, renaming the copies to `.env`. Adjust the values in these files as needed. Example `.env` files:

   - `api-service/.env`

   - `s3-reverse-proxy/.env`

4. Run the following command:

   ```bash
   docker-compose up
   ```

   This command will start the `api-service` and `s3-reverse-proxy` containers.

## Amazon ECS Deployment

The `build-service` is deployed on Amazon ECS. The ECS deployment configuration is not included in this repository, as it requires specific AWS credentials and configurations. Ensure that the necessary AWS CLI tools and configurations are set up on your machine.

## Usage

1. Start the services using Docker Compose:

   ```bash
   docker-compose up
   ```

2. Access the `api-service` at `http://localhost:api-service-port` (replace `api-service-port` with the actual port configured for the `api-service`).

3. When specific API calls are made to the `api-service`, the `build-service` on Amazon ECS will be triggered automatically. This includes providing a GitHub URL of a React project.

4. Upon successful execution, the project will be deployed, and a specific domain will provide the deployed URL.

## Configuration

Ensure to check and modify the configuration files for each service as needed. Configuration files are typically named `docker-compose.yml` for Docker Compose configurations.

## Dependencies

List any dependencies or prerequisites needed to run the project, such as specific versions of Docker, AWS CLI, or other tools.
