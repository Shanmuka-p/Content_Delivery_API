# Content_Delivery_API_
Description
Objective
Design and build a robust, high-performance content delivery API that leverages modern HTTP caching standards and integrates seamlessly with a Content Delivery Network (CDN). The primary goal is to minimize latency for global users and reduce load on the origin server by maximizing cache hit rates at the edge. You will implement sophisticated caching strategies, including ETags for conditional requests, granular Cache-Control headers, and immutable content versioning.

This project will challenge you to think about API design from a performance and scalability perspective. You will gain practical experience in configuring CDNs, managing assets in cloud storage, and securing content while keeping it cacheable. The final service will be a production-grade system capable of delivering static and dynamic content efficiently and securely.

Core Requirements
Data Models
Asset: Must store metadata for each piece of content, including a unique identifier, object storage key, filename, MIME type, size, a strong ETag, current version number, and timestamps.
AssetVersion: Must track immutable versions of an asset, linking back to the parent asset and storing its specific object storage key.
AccessToken: Must support temporary, secure access to private assets, containing a unique token, an expiration time, and a reference to the asset it grants access to.
API Endpoints & Functionality
POST /assets/upload: Accepts a file upload, stores it in a cloud object storage service, creates an Asset record in the database, and returns the asset's metadata.
GET /assets/:id/download: Serves the asset's content. This endpoint must support conditional GET requests using ETag and If-None-Match headers.
HEAD /assets/:id/download: Allows clients to check for content modifications without downloading the body, responding with appropriate headers including the ETag.
POST /assets/:id/publish: Creates a new, immutable AssetVersion for an existing asset, allowing content updates without breaking caches for old versions.
GET /assets/public/:version_id: A public, highly-cacheable endpoint for serving versioned, immutable content directly from the CDN.
GET /assets/private/:token: Provides access to private content using a valid, non-expired AccessToken.
HTTP Caching Requirements
ETag Generation: The system must generate a strong ETag (e.g., an MD5 or SHA-1 hash of the file's content) for every asset upon upload or update.
Conditional Requests: The download endpoints must correctly handle the If-None-Match request header. If the client's ETag matches the server's, the API must respond with a 304 Not Modified status and an empty body.
Cache-Control Headers: The API must set appropriate Cache-Control headers based on the content type:
Public, versioned assets: public, max-age=31536000, immutable
Public, mutable assets: public, s-maxage=3600, max-age=60
Private assets: private, no-store, no-cache, must-revalidate
Last-Modified Header: The API should also include the Last-Modified header in responses for cache validation.
CDN and Storage Integration
Object Storage: The service must use a cloud object storage provider (e.g., AWS S3, Google Cloud Storage) as the source for all assets.
Cache Invalidation: The system must provide a mechanism to invalidate CDN caches when a mutable asset is updated, for instance, by calling the CDN's purge API.
Performance & Security
Cache Hit Ratio: The final system, under simulated load, must be designed to achieve a CDN cache hit ratio of over 95% for public assets.
Origin Shielding: The API's download endpoints should be protected to only allow traffic from the designated CDN, preventing direct access.
Secure Tokens: The token generation mechanism for private assets must be cryptographically secure and tokens must have a short, configurable lifespan.
Implementation Guidelines
Technical Stack Suggestions
Language: Consider statically-typed languages like Go, or dynamically-typed languages with mature ecosystems like Python or Node.js.
Web Framework: Choose a high-performance framework like Gin (Go), FastAPI (Python), or Express/Fastify (Node.js).
Database: A relational database like PostgreSQL is recommended for managing asset metadata and relationships.
Object Storage: AWS S3, Google Cloud Storage, or a compatible alternative like MinIO for self-hosting.
CDN: Cloudflare, AWS CloudFront, or Fastly are excellent choices with powerful caching and security features.
Architectural Design
Decouple Storage: Strictly separate the API server from the file storage. The API should handle metadata and authorization, while generating signed URLs or proxying requests to the object store.
ETag Generation: Generate ETags during the file upload process by hashing the file content. Store this ETag in your database alongside the asset metadata. This avoids re-calculating the hash on every request.
CDN Configuration: Focus on setting up caching rules (or Page Rules/Workers in Cloudflare) that respect the Cache-Control headers sent by your origin API. Configure an "Origin Shield" or similar feature to protect your API from direct traffic.
Cache Invalidation Strategy: For mutable assets, consider a programmatic approach. When an asset is updated, your API should trigger a purge request to the CDN's API. For versioned assets, invalidation is unnecessary; you simply point clients to the new version's URL.
Outcomes
A fully functional API that can upload, version, and serve public and private assets from cloud storage.
Correct implementation of HTTP caching, demonstrated by the API returning 304 Not Modified responses for conditional requests with matching ETags.
Appropriate Cache-Control, ETag, and Last-Modified headers are present and correctly configured on all content-serving responses.
A CDN is successfully configured to cache public assets, achieving a cache hit rate of over 95% during testing.
Private assets are inaccessible without a valid, short-lived access token.
A robust content versioning system that allows for immutable caching of specific asset versions.
A documented and functional cache invalidation process for mutable assets.
A comprehensive test suite that verifies caching logic, endpoint functionality, and security controls.
Implementation Details
Project Structure
Candidates should organize their project in a clear, modular structure. A typical layout might include:

src/ or app/: Main application source code.
config/: Configuration files (e.g., database connection, cloud credentials).
docs/: Markdown documentation files (README.md, ARCHITECTURE.md, API_DOCS.md, PERFORMANCE.md).
tests/: Unit and integration tests.
scripts/: Utility scripts, including database seeding and the benchmark script.
docker-compose.yml: For containerizing the application and its dependencies.
.env.example: An example environment file for necessary configurations.
submission.yml: The mandatory file for automated evaluation.
Database Schema
Candidates should design a relational database schema for managing asset metadata and access tokens.

-- Example Schema for Asset
CREATE TABLE assets (
    id UUID PRIMARY KEY,
    object_storage_key VARCHAR(255) NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    etag VARCHAR(255) NOT NULL, -- Strong ETag (e.g., SHA-256 hash)
    current_version_id UUID, -- Reference to the latest AssetVersion
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Example Schema for AssetVersion (immutable content)
CREATE TABLE asset_versions (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES assets(id),
    object_storage_key VARCHAR(255) NOT NULL UNIQUE, -- Specific key for this version
    etag VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Example Schema for AccessToken
CREATE TABLE access_tokens (
    token VARCHAR(255) PRIMARY KEY, -- Cryptographically secure token
    asset_id UUID NOT NULL REFERENCES assets(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
API Endpoints and Expected Behavior
All API endpoints must adhere to RESTful principles and return appropriate HTTP status codes.

POST /assets/upload

Request: multipart/form-data with a file.
Response: 201 Created with asset metadata, including id and etag.
Behavior: Stores file in object storage, calculates strong ETag, creates Asset record.
GET /assets/:id/download

Request: Optional If-None-Match header.
Response:
200 OK with Content-Type, Content-Length, ETag, Last-Modified, and appropriate Cache-Control headers if ETag doesn't match or If-None-Match is absent.
304 Not Modified with empty body if If-None-Match matches the current ETag.
Behavior: Retrieves asset from object storage or serves 304.
HEAD /assets/:id/download

Response: 200 OK with Content-Type, Content-Length, ETag, Last-Modified, and Cache-Control headers, but no body.
Behavior: Provides metadata without content download.
POST /assets/:id/publish

Request: JSON body (e.g., {"new_content_key": "..."}). This endpoint implies updating the asset and creating a new version.
Response: 200 OK with updated asset metadata.
Behavior: Creates a new AssetVersion, updates Asset.current_version_id. Triggers CDN invalidation for mutable assets.
GET /assets/public/:version_id

Response: 200 OK with Content-Type, Content-Length, ETag, Last-Modified, and Cache-Control: public, max-age=31536000, immutable.
Behavior: Serves specific immutable asset version directly.
GET /assets/private/:token

Request: Token in URL path.
Response:
200 OK with Content-Type, Content-Length, ETag, Last-Modified, and Cache-Control: private, no-store, no-cache, must-revalidate if token is valid.
401 Unauthorized or 403 Forbidden if token is invalid or expired.
Behavior: Validates token, serves private content.
submission.yml Structure
The submission.yml file is critical for automated evaluation. It must define the following commands:

# submission.yml
setup:
  - command: "npm install" # Example for Node.js, adjust for chosen stack
  - command: "pip install -r requirements.txt" # Example for Python
  - command: "docker-compose build"
test:
  - command: "docker-compose run --rm app-service npm test" # Or "pytest", "go test ./..."
benchmark:
  - command: "docker-compose run --rm app-service python scripts/run_benchmark.py" # Example script
The benchmark script (scripts/run_benchmark.py in this example) must simulate traffic to both public and private endpoints, measure cache hit rates, response times, and output a summary that can be parsed for the PERFORMANCE.md report.

Common Mistakes To Avoid
Weak ETags: Generating ETags based on timestamps or simple identifiers instead of content hashes, leading to incorrect caching behavior.
Incorrect Cache-Control Headers: Misconfiguring Cache-Control directives, resulting in either stale content being served or content not being cached at all.
Insecure Token Handling: Using easily guessable or non-expiring tokens for private content, or exposing tokens in logs/URLs unnecessarily.
Direct Origin Access: Not implementing origin shielding, allowing clients to bypass the CDN and directly hit the API, negating CDN benefits.
Inefficient ETag Calculation: Recalculating content hashes on every GET request instead of storing them on upload/update.
Lack of CDN Invalidation for Mutable Content: Updating mutable assets without purging the CDN cache, leading to users seeing old content.
Poor Error Handling: Not providing clear error messages or status codes for API failures (e.g., file not found, unauthorized access).
Monolithic Design: Tightly coupling the API, database, and object storage logic, making it hard to scale or maintain.
FAQ
Q: Can I use a local object storage solution like MinIO for development? A: Yes, using MinIO or a similar local solution is perfectly acceptable for development and testing, as long as the production deployment targets a cloud object storage provider. Ensure your docker-compose.yml can spin up MinIO if you choose that.

Q: Do I need to implement a full user authentication system? A: No, a full user authentication system is not required. The focus for private content is on the secure generation and validation of temporary access tokens, not user management.

Q: How granular should the CDN cache invalidation be? A: For mutable assets, invalidation should be as granular as possible (e.g., invalidating a single object by its URL). For versioned immutable assets, no explicit invalidation is needed; clients simply request the new version URL.

Q: What tools should I use for load testing and performance measurement? A: You can use tools like Apache JMeter, k6, Locust, or even simple curl scripts for basic benchmarking. The key is to demonstrate the cache hit ratio effectively.

Q: Is it mandatory to use a specific cloud provider for CDN and object storage? A: No, you are free to choose any cloud provider (e.g., AWS, GCP, Azure) or CDN service (e.g., Cloudflare, CloudFront, Fastly) that meets the requirements. The principles of caching and content delivery are universal.


