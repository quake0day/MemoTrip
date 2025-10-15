import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_DATA_ROOT = path.resolve(path.join(process.cwd(), 'data'));
const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_ROOT || path.join(DEFAULT_DATA_ROOT, 'uploads')
);
const EXPORT_ROOT = path.resolve(
  process.env.EXPORT_ROOT || path.join(DEFAULT_DATA_ROOT, 'exports')
);
const THUMB_ROOT = path.resolve(
  process.env.THUMB_ROOT || path.join(DEFAULT_DATA_ROOT, 'thumbs')
);

function normalizeRelative(relativePath: string) {
  return relativePath.replace(/\\/g, '/');
}

function resolveStoragePath(relativePath: string) {
  const normalized = normalizeRelative(relativePath);
  if (normalized.startsWith('uploads/')) {
    const rest = normalized.replace(/^uploads\//, '');
    return path.join(UPLOAD_ROOT, rest);
  }
  if (normalized.startsWith('exports/')) {
    const rest = normalized.replace(/^exports\//, '');
    return path.join(EXPORT_ROOT, rest);
  }
  if (normalized.startsWith('thumbs/')) {
    const rest = normalized.replace(/^thumbs\//, '');
    return path.join(THUMB_ROOT, rest);
  }
  throw new Error(`Unsupported storage path: ${relativePath}`);
}

export async function ensureDir(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function saveFile(
  buffer: Buffer,
  filename: string,
  type: 'receipt' | 'photo' | 'export' | 'thumb'
): Promise<string> {
  let root: string;
  let prefix: string;
  switch (type) {
    case 'receipt':
      root = path.join(UPLOAD_ROOT, 'receipts');
      prefix = 'uploads/receipts';
      break;
    case 'photo':
      root = path.join(UPLOAD_ROOT, 'photos');
      prefix = 'uploads/photos';
      break;
    case 'export':
      root = EXPORT_ROOT;
      prefix = 'exports';
      break;
    case 'thumb':
      root = THUMB_ROOT;
      prefix = 'thumbs';
      break;
    default:
      throw new Error(`Unsupported file type: ${type}`);
  }

  await ensureDir(root);

  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const newFilename = `${basename}-${timestamp}-${random}${ext}`;
  const filePath = path.join(root, newFilename);

  await fs.writeFile(filePath, buffer);

  return normalizeRelative(`${prefix}/${newFilename}`);
}

export async function readFile(relativePath: string): Promise<Buffer> {
  const fullPath = resolveStoragePath(relativePath);
  return await fs.readFile(fullPath);
}

export async function deleteFile(relativePath: string): Promise<void> {
  const fullPath = resolveStoragePath(relativePath);
  try {
    await fs.unlink(fullPath);
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
}

export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function resolveRelativeStoragePath(relativePath: string) {
  return resolveStoragePath(relativePath);
}
