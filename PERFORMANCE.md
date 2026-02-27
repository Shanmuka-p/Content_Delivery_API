# Content Delivery API - Performance & Evaluation Report

**Developer:** Padala Shanmuka Reddy  
**Roll Number:** 23P31A05H8  
**Institution:** Aditya college of engineering and technology

## Architecture Overview

This origin API is optimized for seamless CDN integration. It utilizes Fastify for high-throughput routing, PostgreSQL for rapid ETag and metadata validation, and MinIO (S3-compatible) for object storage. By validating ETags strictly at the database layer, the origin completely shields the object storage from redundant reads, drastically reducing bandwidth and internal network latency.

## Load Testing Benchmark Results

A benchmark simulation was executed to replicate edge node traffic requesting a single asset 100 times sequentially.

- **Total Simulated Edge Requests:** 100
- **Cache Misses (Full Origin Fetch):** 1
- **Cache Hits (304 Not Modified):** 99
- **Average Response Time:** 3.36ms
- **Final Cache Hit Ratio:** **99%**

## Conclusion

The API successfully exceeds the >95% cache hit ratio requirement. After the initial cache miss (where the file is downloaded and the ETag is cached at the edge), 100% of subsequent requests with a matching `If-None-Match` header are successfully intercepted. These requests are resolved with an empty `304 Not Modified` response via a lightweight PostgreSQL query, verifying that edge caching logic is correctly implemented and origin bandwidth is preserved.
