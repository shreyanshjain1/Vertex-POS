import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ALLOWED_PRODUCT_IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif']
]);

const DEFAULT_MAX_PRODUCT_IMAGE_UPLOAD_MB = 5;

export function getMaxProductImageUploadBytes() {
  const configured = Number(process.env.MAX_PRODUCT_IMAGE_UPLOAD_MB ?? DEFAULT_MAX_PRODUCT_IMAGE_UPLOAD_MB);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_MAX_PRODUCT_IMAGE_UPLOAD_MB * 1024 * 1024;
  }

  return Math.floor(configured * 1024 * 1024);
}

export function isSupportedProductImageType(contentType: string) {
  return ALLOWED_PRODUCT_IMAGE_TYPES.has(contentType);
}

export function isStoredProductImagePath(value: string) {
  return /^\/uploads\/products\/[a-z0-9/_-]+\.(jpg|png|webp|gif)$/i.test(value);
}

export function isSupportedRemoteImageUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function getPublicProductImageDirectory() {
  return path.join(process.cwd(), 'public', 'uploads', 'products');
}

export async function saveProductImageFile(file: File, shopId: string) {
  const contentType = file.type || 'application/octet-stream';
  if (!isSupportedProductImageType(contentType)) {
    throw new Error('Only JPG, PNG, WEBP, and GIF images are supported.');
  }

  const maxBytes = getMaxProductImageUploadBytes();
  if (file.size <= 0) {
    throw new Error('Image file is empty.');
  }

  if (file.size > maxBytes) {
    throw new Error(`Image must be ${Math.round(maxBytes / (1024 * 1024))}MB or smaller.`);
  }

  const extension = ALLOWED_PRODUCT_IMAGE_TYPES.get(contentType);
  if (!extension) {
    throw new Error('Unsupported image type.');
  }

  const date = new Date();
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const safeShopId = shopId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'shop';
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const relativeDirectory = path.posix.join('uploads', 'products', safeShopId, year, month);
  const outputDirectory = path.join(process.cwd(), 'public', relativeDirectory);
  const outputPath = path.join(outputDirectory, fileName);

  await mkdir(outputDirectory, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  return {
    imageUrl: `/${path.posix.join(relativeDirectory, fileName)}`,
    bytes: file.size,
    contentType
  };
}
