import { S3Client } from "@aws-sdk/client-s3";
import "dotenv/config";

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.AWS_S3_ENDPOINT || "http://localhost:9000",
  forcePathStyle: true,
  credentials: {
    // Changed the fallbacks from "" to "minioadmin"
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "minioadmin",
  },
});

export const BUCKET_NAME = process.env.S3_BUCKET_NAME || "assets";
