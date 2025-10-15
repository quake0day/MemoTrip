import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createHouseholdSchema = z.object({
  displayName: z.string().min(1),
  userId: z.string(), // Owner user ID
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { displayName, userId } = createHouseholdSchema.parse(body);

    const household = await prisma.household.create({
      data: {
        displayName,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
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
      },
    });

    return NextResponse.json({ household }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Create household error:', error);
    return NextResponse.json(
      { error: 'Failed to create household' },
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

    const households = await prisma.household.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ households });
  } catch (error) {
    console.error('Get households error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch households' },
      { status: 500 }
    );
  }
}
