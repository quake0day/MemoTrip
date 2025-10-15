import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveFile, calculateFileHash } from '@/lib/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploaderId =
      (formData.get('uploaderId') as string) ||
      (formData.get('userId') as string);

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!uploaderId) {
      return NextResponse.json({ error: 'Uploader ID required' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileHash = calculateFileHash(buffer);

    // Check for duplicate
    const existing = await prisma.receipt.findFirst({
      where: { tripId, fileHash },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Duplicate receipt detected' },
        { status: 409 }
      );
    }

    const filePath = await saveFile(buffer, file.name, 'receipt');

    const receipt = await prisma.receipt.create({
      data: {
        tripId,
        uploaderId,
        filePath,
        fileHash,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    console.error('Upload receipt error:', error);
    return NextResponse.json(
      { error: 'Failed to upload receipt' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;

    const receipts = await prisma.receipt.findMany({
      where: { tripId },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ receipts });
  } catch (error) {
    console.error('Get receipts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch receipts' },
      { status: 500 }
    );
  }
}
