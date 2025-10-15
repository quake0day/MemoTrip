import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createTripSchema = z.object({
  name: z.string().min(1),
  currency: z.string().default('USD'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  userId: z.string(), // In production, get from session
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, currency, startDate, endDate, userId } = createTripSchema.parse(body);

    // Find user's household
    const userHousehold = await prisma.householdMember.findFirst({
      where: {
        userId,
        role: 'OWNER',
      },
      select: {
        householdId: true,
      },
    });

    const trip = await prisma.trip.create({
      data: {
        name,
        currency,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        admins: {
          create: {
            userId,
          },
        },
        // Automatically add creator's household as participant
        participants: userHousehold ? {
          create: {
            householdId: userHousehold.householdId,
            weight: 1.0,
          },
        } : undefined,
      },
      include: {
        admins: true,
        participants: {
          include: {
            household: true,
          },
        },
      },
    });

    return NextResponse.json({ trip }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Create trip error:', error);
    return NextResponse.json(
      { error: 'Failed to create trip' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Get trips where user is admin
    const trips = await prisma.trip.findMany({
      where: {
        admins: {
          some: {
            userId,
          },
        },
      },
      include: {
        admins: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        participants: {
          include: {
            household: true,
          },
        },
        _count: {
          select: {
            receipts: true,
            photos: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ trips });
  } catch (error) {
    console.error('Get trips error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trips' },
      { status: 500 }
    );
  }
}
