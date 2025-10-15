import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;

    const settlements = await prisma.settlement.findMany({
      where: { tripId },
      orderBy: {
        version: 'desc',
      },
    });

    return NextResponse.json({ settlements });
  } catch (error) {
    console.error('Error fetching settlements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settlements' },
      { status: 500 }
    );
  }
}
