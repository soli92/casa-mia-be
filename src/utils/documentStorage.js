import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const MAX_BYTES = 25 * 1024 * 1024;
const PRESIGN_TTL_SEC = 900;
const PRESIGN_GET_TTL_SEC = 900;

function trimBase(url) {
  return String(url ?? '').replace(/\/+$/, '');
}

/** Bucket + credenziali: sufficiente per upload e URL firmati in lettura (bucket privato ok). */
export function isDocumentStorageConfigured() {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
  );
}

export function getMaxDocumentBytes() {
  return MAX_BYTES;
}

function getS3Client() {
  const region = process.env.S3_REGION || 'auto';
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const forcePathStyle =
    process.env.S3_FORCE_PATH_STYLE === '1' ||
    process.env.S3_FORCE_PATH_STYLE === 'true' ||
    Boolean(endpoint);

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle,
  });
}

export function sanitizeOriginalFilename(name) {
  const base = String(name || 'documento')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return base || 'documento';
}

export function isAllowedDocumentMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (!m) return false;
  if (m === 'application/octet-stream') return true;
  if (m.startsWith('image/')) return true;
  const allow = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ]);
  return allow.has(m);
}

/**
 * @param {string} familyId
 * @param {string} originalName
 */
export function buildStorageKey(familyId, originalName) {
  const safe = sanitizeOriginalFilename(originalName).replace(/\s/g, '_');
  return `families/${familyId}/${randomUUID()}-${safe}`;
}

/** Solo se `S3_PUBLIC_URL` è impostato (CDN pubblico legacy). */
export function buildPublicUrl(storageKey) {
  const base = trimBase(process.env.S3_PUBLIC_URL);
  if (!base) return '';
  const key = String(storageKey).replace(/^\/+/, '');
  return `${base}/${encodeURI(key).replace(/%2F/g, '/')}`;
}

/**
 * @param {string} storageKey
 * @returns {Promise<string>}
 */
export async function getPresignedGetUrl(storageKey) {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });
  return getSignedUrl(client, cmd, { expiresIn: PRESIGN_GET_TTL_SEC });
}

/**
 * @param {string} storageKey
 * @param {string} contentType
 * @returns {Promise<string>}
 */
export async function getPresignedPutUrl(storageKey, contentType) {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: contentType,
  });
  return getSignedUrl(client, cmd, { expiresIn: PRESIGN_TTL_SEC });
}

/**
 * @param {string} storageKey
 */
export async function headObjectMeta(storageKey) {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;
  const out = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: storageKey })
  );
  return {
    contentLength: out.ContentLength ?? 0,
    contentType: out.ContentType ?? '',
  };
}

/**
 * @param {string} storageKey
 */
export async function deleteObject(storageKey) {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })
  );
}
