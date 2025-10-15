import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/storage';
import { z } from 'zod';

const updatePhotoSchema = z.object({
  tags: z.array(z.string().min(1)).max(20).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; photoId: string }> }
) {
  try {
    const { tripId, photoId } = await params;
    const body = await request.json();
    const parsed = updatePhotoSchema.parse(body);

    const photo = await prisma.photo.findFirst({
      where: {
        id: photoId,
        tripId,
      },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const updated = await prisma.photo.update({
      where: { id: photoId },
      data: {
        tagsJson: parsed.tags ?? photo.tagsJson,
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

    return NextResponse.json({
      photo: {
        ...updated,
        tags: Array.isArray(updated.tagsJson) ? updated.tagsJson : [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to update photo metadata:', error);
    return NextResponse.json(
      { error: 'Failed to update photo metadata' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string; photoId: string }> }
) {
  try {
    const { tripId, photoId } = await params;

    const photo = await prisma.photo.findFirst({
      where: {
        id: photoId,
        tripId,
      },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    await prisma.photo.delete({
      where: { id: photoId },
    });

    await Promise.all(
      [photo.filePath, photo.thumbPath]
        .filter((path): path is string => Boolean(path))
        .map(path => deleteFile(path))
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete photo:', error);
    return NextResponse.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    );
  }
}
