import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';

const PUBLIC_ROOT = path.join(process.cwd(), 'public');
const PRODUCT_UPLOAD_ROOT = path.join(PUBLIC_ROOT, 'uploads', 'products');

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'shop';
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'image/svg+xml') return '.svg';
  return '.bin';
}

function maxUploadBytes() {
  const mb = Number(process.env.MAX_PRODUCT_IMAGE_UPLOAD_MB || '5');
  return Number.isFinite(mb) && mb > 0 ? Math.floor(mb * 1024 * 1024) : 5 * 1024 * 1024;
}

export function isLocalProductUploadPath(value: string) {
  return value.startsWith('/uploads/products/');
}

export function extractLocalProductUploadPaths(values: string[]) {
  const paths = new Set<string>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;

    if (isLocalProductUploadPath(normalized)) {
      paths.add(normalized);
      continue;
    }

    try {
      const parsed = new URL(normalized);
      if (isLocalProductUploadPath(parsed.pathname)) {
        paths.add(parsed.pathname);
      }
    } catch {
      // ignore non-URL values
    }
  }

  return [...paths];
}

export async function saveProductImageUpload(shopId: string, file: File) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('No upload file received.');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Only image uploads are allowed.');
  }

  if (file.size <= 0) {
    throw new Error('Uploaded image is empty.');
  }

  if (file.size > maxUploadBytes()) {
    throw new Error(`Image exceeds the ${process.env.MAX_PRODUCT_IMAGE_UPLOAD_MB || '5'} MB upload limit.`);
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeShopId = sanitizeSegment(shopId);
  const extension = extensionFromMimeType(file.type);
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const relativeDirectory = path.posix.join('/uploads/products', safeShopId, year, month);
  const relativePath = path.posix.join(relativeDirectory, fileName);
  const absoluteDirectory = path.join(PRODUCT_UPLOAD_ROOT, safeShopId, year, month);
  const absolutePath = path.join(absoluteDirectory, fileName);

  await mkdir(absoluteDirectory, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return relativePath;
}

export async function deleteLocalProductUploads(pathsToDelete: string[]) {
  const uniquePaths = [...new Set(pathsToDelete.filter(Boolean))];

  await Promise.all(
    uniquePaths.map(async (relativePath) => {
      if (!isLocalProductUploadPath(relativePath)) {
        return;
      }

      const normalized = path.posix.normalize(relativePath);
      if (!normalized.startsWith('/uploads/products/')) {
        return;
      }

      const absolutePath = path.join(PUBLIC_ROOT, normalized.replace(/^\/+/, ''));
      await rm(absolutePath, { force: true });
    })
  );
}
