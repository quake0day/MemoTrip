import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || './data/uploads';
const EXPORT_ROOT = process.env.EXPORT_ROOT || './data/exports';
const THUMB_ROOT = process.env.THUMB_ROOT || './data/thumbs';

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
  const root = type === 'receipt' ? path.join(UPLOAD_ROOT, 'receipts')
    : type === 'photo' ? path.join(UPLOAD_ROOT, 'photos')
    : type === 'export' ? EXPORT_ROOT
    : THUMB_ROOT;

  await ensureDir(root);

  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const newFilename = `${basename}-${timestamp}-${random}${ext}`;
  const filePath = path.join(root, newFilename);

  await fs.writeFile(filePath, buffer);

  // Return relative path for database storage
  return path.relative(process.cwd(), filePath);
}

export async function readFile(relativePath: string): Promise<Buffer> {
  const fullPath = path.join(process.cwd(), relativePath);
  return await fs.readFile(fullPath);
}

export async function deleteFile(relativePath: string): Promise<void> {
  const fullPath = path.join(process.cwd(), relativePath);
  try {
    await fs.unlink(fullPath);
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
}

export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
