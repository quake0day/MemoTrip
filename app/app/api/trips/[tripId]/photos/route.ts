import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveFile } from '@/lib/storage';
import * as exifr from 'exifr';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;

    const photos = await prisma.photo.findMany({
      where: { tripId },
      include: {
        uploader: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const serialized = photos.map((photo) => ({
      ...photo,
      tags: Array.isArray(photo.tagsJson) ? photo.tagsJson : [],
    }));

    return NextResponse.json({ photos: serialized });
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Check if trip exists
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save the file
    const filePath = await saveFile(buffer, file.name, 'photo');

    let exifData: Record<string, unknown> | null = null;
    let width: number | null = null;
    let height: number | null = null;

    try {
      const parsed = await exifr.parse(buffer, { translateValues: true });
      if (parsed && typeof parsed === 'object') {
        exifData = parsed as Record<string, unknown>;
        if (typeof parsed.ImageWidth === 'number') {
          width = parsed.ImageWidth;
        }
        if (typeof parsed.ImageHeight === 'number') {
          height = parsed.ImageHeight;
        }
      }
    } catch (exifError) {
      console.warn('Failed to parse EXIF metadata:', exifError);
    }

    // Create photo record
    const photo = await prisma.photo.create({
      data: {
        tripId,
        filePath,
        uploaderId: userId,
        exifJson: exifData,
        width: width ?? undefined,
        height: height ?? undefined,
      },
      include: {
        uploader: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        photo: {
          ...photo,
          tags: [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
