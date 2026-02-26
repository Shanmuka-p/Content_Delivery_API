// src/config/db.ts
import { Pool } from "pg";
import "dotenv/config";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Recommended pool settings for an API
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});
