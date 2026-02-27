# Content Delivery API

This project is a robust, high-performance content delivery API designed to work seamlessly with Content Delivery Networks (CDNs). It focuses on minimizing latency and reducing server load by implementing modern HTTP caching standards, including ETags, granular Cache-Control headers, and immutable content versioning.

## Features

- **High-Performance**: Built with Fastify for high-throughput and low overhead.
- **Advanced Caching**: Implements ETag-based conditional requests, resulting in `304 Not Modified` responses to reduce bandwidth.
- **Immutable Content**: Supports creating immutable, versioned assets that can be cached forever by CDNs.
- **CDN-Friendly**: Designed to act as an origin server for any CDN.
- **Flexible Storage**: Uses S3-compatible object storage (MinIO for local development).
- **Relational Metadata**: Leverages PostgreSQL to store asset metadata for fast lookups.

## Performance

The API is optimized for a high cache-hit ratio. Benchmarks show a **99% cache-hit ratio** under simulated load, drastically reducing the number of requests that hit the object storage service. See `PERFORMANCE.md` for more details.

## Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Shanmuka-p/Content_Delivery_API.git
cd Content_Delivery_API
```

### 2. Set up Environment Variables

Copy the example environment file and update it if necessary. The default values are configured to work with the Docker setup.

```bash
cp .env.example .env
```

### 3. Start the Development Environment

This command will start PostgreSQL and MinIO containers in the background.

```bash
docker-compose up -d
```

The services will be available at:
- **PostgreSQL**: `localhost:5432`
- **MinIO API**: `localhost:9000`
- **MinIO Console**: `http://localhost:9001`

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

```bash
npm run dev
```

The API will be running at `http://localhost:3000`.

## Available Scripts

- `npm run dev`: Starts the development server with hot-reloading.
- `npm run build`: Compiles the TypeScript code to JavaScript.
- `npm run start`: Starts the production server (requires `npm run build` first).
- `npm test`: Runs the API tests.
- `npm run benchmark`: Runs the performance benchmark script.

## Environment Variables

| Variable                | Description                                        | Default                  |
| ----------------------- | -------------------------------------------------- | ------------------------ |
| `PORT`                  | Port for the API server.                           | `3000`                   |
| `HOST`                  | Host for the API server.                           | `0.0.0.0`                |
| `DATABASE_URL`          | Connection string for the PostgreSQL database.     | `postgres://...`         |
| `AWS_REGION`            | S3-compatible storage region.                      | `us-east-1`              |
| `AWS_ACCESS_KEY_ID`     | Access key for the S3-compatible storage.          | `minioadmin`             |
| `AWS_SECRET_ACCESS_KEY` | Secret key for the S3-compatible storage.          | `minioadmin`             |
| `AWS_S3_ENDPOINT`       | Endpoint URL for the S3-compatible storage.        | `http://localhost:9000`  |
| `S3_BUCKET_NAME`        | Name of the bucket to store assets in.             | `assets`                 |

## API Endpoints

You can import the `postman_collection.json` file into Postman to test the API.

### `POST /assets/upload`

Uploads a new asset.

- **Body**: `multipart/form-data`
  - `file`: The file to upload.
  - `is_private` (optional): `true` or `false`. Defaults to `false`.
- **Response**: `201 Created` with asset metadata.

### `GET /assets/:id/download`

Downloads a public, mutable asset. This endpoint supports conditional requests using the `If-None-Match` header.

- **Headers**:
  - `If-None-Match`: The ETag of the cached asset.
- **Response**:
  - `200 OK`: The file stream if the ETag does not match.
  - `304 Not Modified`: An empty body if the ETag matches.

### `POST /assets/:id/publish`

Creates a new, immutable version of an existing asset.

- **Response**: `200 OK` with the new version ID.

### `GET /assets/public/:version_id`

Downloads a public, immutable version of an asset. This endpoint returns a `Cache-Control` header for long-term caching.

- **Response**: `200 OK` with the file stream.

## Running Tests

To run the automated tests:

```bash
npm test
```

## Built With

- [Fastify](https://www.fastify.io/) - Web Framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [MinIO](https://min.io/) - S3-Compatible Object Storage
- [TypeScript](https://www.typescriptlang.org/) - Language
