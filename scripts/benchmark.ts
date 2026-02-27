const API_URL = process.env.API_URL || "http://localhost:3000";
const TOTAL_REQUESTS = 100;

async function runBenchmark() {
  console.log("🚀 Starting CDN Cache Benchmark...\n");

  const formData = new FormData();
  formData.append(
    "file",
    new Blob(["Benchmark Data"], { type: "text/plain" }),
    "bench.txt",
  );

  const uploadRes = await fetch(`${API_URL}/assets/upload`, {
    method: "POST",
    body: formData,
  });
  const { id, etag } = await uploadRes.json();

  let cacheHits = 0;
  let cacheMisses = 0;
  let totalTime = 0;

  console.log(`Simulating ${TOTAL_REQUESTS} requests from edge nodes...`);

  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    const start = performance.now();
    const headers: Record<string, string> =
      i > 0 ? { "If-None-Match": etag } : {};
    const res = await fetch(`${API_URL}/assets/${id}/download`, { headers });
    totalTime += performance.now() - start;

    if (res.status === 304) cacheHits++;
    else if (res.status === 200) cacheMisses++;
  }

  const hitRatio = (cacheHits / TOTAL_REQUESTS) * 100;

  console.log("\n📊 --- Benchmark Results ---");
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`Cache Misses (Origin Fetches): ${cacheMisses}`);
  console.log(`Cache Hits (304 Not Modified): ${cacheHits}`);
  console.log(
    `Avg Response Time: ${(totalTime / TOTAL_REQUESTS).toFixed(2)}ms`,
  );
  console.log(`Cache Hit Ratio: ${hitRatio}%`);

  if (hitRatio >= 95) console.log("\n✅ PASS: Cache Hit Ratio is > 95%!");
  else
    console.log("\n❌ FAIL: Cache Hit Ratio did not meet the 95% requirement.");
}

runBenchmark().catch(console.error);
