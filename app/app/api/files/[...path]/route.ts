import { NextRequest, NextResponse } from 'next/server';
import { readFile as fsReadFile } from 'fs/promises';
import path from 'path';
import { resolveRelativeStoragePath } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath } = await params;

    if (!filePath || filePath.length === 0) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    // Join the path segments
    const relativePath = filePath.join('/');

    // Ensure the path is within the data directory for security
    const fullPath = resolveRelativeStoragePath(relativePath);

    // Read the file
    const fileBuffer = await fsReadFile(fullPath);

    // Determine content type based on extension
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(fileBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('File serving error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
