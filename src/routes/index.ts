import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PutObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/db';
import { s3Client, BUCKET_NAME } from '../config/storage';
import { generateStrongETag, generateSecureToken } from '../utils/hash';
import { MultipartFile } from '@fastify/multipart';

// Define interfaces for request parameters
interface IdParams {
  id: string;
}

interface VersionIdParams {
  version_id: string;
}

interface TokenParams {
  token: string;
}

export default async function routes(fastify: FastifyInstance) {
  
  // 1. UPLOAD ASSET
  fastify.post('/assets/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const data: MultipartFile | undefined = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const buffer = await data.toBuffer();
    const etag = generateStrongETag(buffer);
    const objectKey = uuidv4();
    
    // Correctly handle the 'is_private' field
    const isPrivateField = data.fields.is_private as { value: string } | undefined;
    const isPrivate = isPrivateField?.value === 'true';

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      Body: buffer,
      ContentType: data.mimetype,
    }));

    const result = await pool.query(
      `INSERT INTO assets (object_storage_key, filename, mime_type, size_bytes, etag, is_private) 
       VALUES (, $2, $3, $4, $5, $6) RETURNING *`,
      [objectKey, data.filename, data.mimetype, buffer.length, etag, isPrivate]
    );
    return reply.status(201).send(result.rows[0]);
  });

  // 2. DOWNLOAD PUBLIC MUTABLE ASSET
  fastify.get('/assets/:id/download', async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM assets WHERE id = ', [id]);
    const asset = rows[0];

    if (!asset) return reply.status(404).send({ error: 'Not found' });
    if (asset.is_private) return reply.status(403).send({ error: 'Asset is private' });

    reply.header('ETag', asset.etag);
    reply.header('Last-Modified', new Date(asset.updated_at).toUTCString());
    reply.header('Cache-Control', 'public, s-maxage=3600, max-age=60');
    reply.header('Content-Type', asset.mime_type);

    if (req.headers['if-none-match'] === asset.etag) {
      return reply.status(304).send();
    }

    const s3Res = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: asset.object_storage_key }));
    return reply.status(200).send(s3Res.Body);
  });

  // 3. PUBLISH IMMUTABLE VERSION
  fastify.post('/assets/:id/publish', async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM assets WHERE id = ', [id]);
    const asset = rows[0];
    if (!asset) return reply.status(404).send({ error: 'Not found' });

    const newVersionKey = uuidv4();
    
    // Copy the object in S3 to freeze the version
    await s3Client.send(new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${asset.object_storage_key}`,
      Key: newVersionKey
    }));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const versionRes = await client.query(
        `INSERT INTO asset_versions (asset_id, object_storage_key, etag) VALUES (, $2, $3) RETURNING id`,
        [id, newVersionKey, asset.etag]
      );
      const versionId = versionRes.rows[0].id;
      
      const updatedAsset = await client.query(
        `UPDATE assets SET current_version_id = , updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
        [versionId, id]
      );
      await client.query('COMMIT');
      return reply.status(200).send(updatedAsset.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // 4. DOWNLOAD PUBLIC IMMUTABLE VERSION
  fastify.get('/assets/public/:version_id', async (req: FastifyRequest<{ Params: VersionIdParams }>, reply: FastifyReply) => {
    const { version_id } = req.params;
    const { rows } = await pool.query(
      `SELECT v.*, a.mime_type FROM asset_versions v JOIN assets a ON v.asset_id = a.id WHERE v.id = `,
      [version_id]
    );
    const version = rows[0];
    if (!version) return reply.status(404).send({ error: 'Version not found' });

    // IMMUTABLE CACHING HEADERS
    reply.header('ETag', version.etag);
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    reply.header('Content-Type', version.mime_type);

    const s3Res = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: version.object_storage_key }));
    return reply.status(200).send(s3Res.Body);
  });

  // 5. GENERATE PRIVATE ACCESS TOKEN
  fastify.post('/assets/:id/token', async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    const { id } = req.params;
    const token = generateSecureToken();
    // Token expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60000); 

    await pool.query(
      `INSERT INTO access_tokens (token, asset_id, expires_at) VALUES (, $2, $3)`,
      [token, id, expiresAt]
    );
    return reply.status(201).send({ token, expiresAt });
  });

  // 6. DOWNLOAD PRIVATE ASSET
  fastify.get('/assets/private/:token', async (req: FastifyRequest<{ Params: TokenParams }>, reply: FastifyReply) => {
    const { token } = req.params;
    
    const { rows } = await pool.query(
      `SELECT t.*, a.object_storage_key, a.mime_type, a.etag 
       FROM access_tokens t JOIN assets a ON t.asset_id = a.id 
       WHERE t.token =  AND t.expires_at > CURRENT_TIMESTAMP`,
      [token]
    );

    const accessInfo = rows[0];
    if (!accessInfo) return reply.status(403).send({ error: 'Invalid or expired token' });

    // STRICT PRIVATE CACHING HEADERS
    reply.header('ETag', accessInfo.etag);
    reply.header('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    reply.header('Content-Type', accessInfo.mime_type);

    const s3Res = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: accessInfo.object_storage_key }));
    return reply.status(200).send(s3Res.Body);
  });
}