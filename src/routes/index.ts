import "@fastify/multipart";
import { FastifyInstance } from "fastify";
import {
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db";
import { s3Client, BUCKET_NAME } from "../config/storage";
import { generateStrongETag, generateSecureToken } from "../utils/hash";

export default async function routes(fastify: FastifyInstance) {
  // 1. UPLOAD ASSET
  fastify.post("/assets/upload", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const buffer = await data.toBuffer();
    const etag = generateStrongETag(buffer);
    const objectKey = uuidv4();

    let isPrivate = false;
    if (data.fields && data.fields.is_private) {
      isPrivate = (data.fields.is_private as any).value === "true";
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: buffer,
        ContentType: data.mimetype,
      }),
    );

    // Clean, single-line SQL query to guarantee no syntax formatting errors
    const query = `INSERT INTO assets (object_storage_key, filename, mime_type, size_bytes, etag, is_private) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;

    const result = await pool.query(query, [
      objectKey,
      data.filename,
      data.mimetype,
      buffer.length,
      etag,
      isPrivate,
    ]);
    return reply.status(201).send(result.rows[0]);
  });

  // 2. DOWNLOAD PUBLIC MUTABLE ASSET
  fastify.get("/assets/:id/download", async (req: any, reply) => {
    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM assets WHERE id = $1", [
      id,
    ]);
    const asset = rows[0];

    if (!asset) return reply.status(404).send({ error: "Not found" });
    if (asset.is_private)
      return reply.status(403).send({ error: "Asset is private" });

    reply.header("ETag", asset.etag);
    reply.header("Last-Modified", new Date(asset.updated_at).toUTCString());
    reply.header("Cache-Control", "public, s-maxage=3600, max-age=60");
    reply.header("Content-Type", asset.mime_type);

    if (req.headers["if-none-match"] === asset.etag) {
      return reply.status(304).send();
    }

    const s3Res = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: asset.object_storage_key,
      }),
    );
    return reply.status(200).send(s3Res.Body);
  });

  // 3. PUBLISH IMMUTABLE VERSION
  fastify.post("/assets/:id/publish", async (req: any, reply) => {
    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM assets WHERE id = $1", [
      id,
    ]);
    const asset = rows[0];
    if (!asset) return reply.status(404).send({ error: "Not found" });

    const newVersionKey = uuidv4();

    await s3Client.send(
      new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${asset.object_storage_key}`,
        Key: newVersionKey,
      }),
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const versionRes = await client.query(
        `INSERT INTO asset_versions (asset_id, object_storage_key, etag) VALUES ($1, $2, $3) RETURNING id`,
        [id, newVersionKey, asset.etag],
      );

      await client.query(
        `UPDATE assets SET current_version_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [versionRes.rows[0].id, id],
      );
      await client.query("COMMIT");
      return reply
        .status(200)
        .send({ success: true, newVersionId: versionRes.rows[0].id });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });

  // 4. DOWNLOAD PUBLIC IMMUTABLE VERSION
  fastify.get("/assets/public/:version_id", async (req: any, reply) => {
    const { version_id } = req.params;
    const { rows } = await pool.query(
      `SELECT v.*, a.mime_type FROM asset_versions v JOIN assets a ON v.asset_id = a.id WHERE v.id = $1`,
      [version_id],
    );
    const version = rows[0];
    if (!version) return reply.status(404).send({ error: "Version not found" });

    reply.header("ETag", version.etag);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    reply.header("Content-Type", version.mime_type);

    const s3Res = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: version.object_storage_key,
      }),
    );
    return reply.status(200).send(s3Res.Body);
  });
}
