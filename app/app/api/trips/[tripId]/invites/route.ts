import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const createInviteSchema = z.object({
  email: z.string().email(),
  householdName: z.string().min(1),
  weight: z.number().min(0).max(2).default(1),
  createdBy: z.string(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;

    const invites = await prisma.invite.findMany({
      where: {
        tripId,
      },
      include: {
        household: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('Failed to fetch invites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invites' },
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
    const body = await request.json();
    const { email, householdName, weight, createdBy } = createInviteSchema.parse(body);

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        participants: true,
        admins: true,
      },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const isAdmin = trip.admins.some((admin) => admin.userId === createdBy);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        householdMembers: true,
      },
    });

    let householdId: string;

    if (existingUser) {
      const ownerMembership = existingUser.householdMembers.find((member) => member.role === 'OWNER');
      if (ownerMembership) {
        householdId = ownerMembership.householdId;
      } else {
        const createdHousehold = await prisma.household.create({
          data: {
            displayName: householdName,
            members: {
              create: {
                userId: existingUser.id,
                role: 'OWNER',
              },
            },
          },
        });
        householdId = createdHousehold.id;
      }
    } else {
      const createdHousehold = await prisma.household.create({
        data: {
          displayName: householdName,
        },
      });
      householdId = createdHousehold.id;
    }

    const existingParticipant = await prisma.tripParticipant.findUnique({
      where: {
        tripId_householdId: {
          tripId,
          householdId,
        },
      },
    });

    if (!existingParticipant) {
      await prisma.tripParticipant.create({
        data: {
          tripId,
          householdId,
          weight,
        },
      });
    }

    const code = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    const invite = await prisma.invite.create({
      data: {
        tripId,
        email,
        householdId,
        code,
        expiresAt,
        createdBy,
        maxUses: 1,
        used: existingUser ? 1 : 0,
      },
      include: {
        household: true,
      },
    });

    if (existingUser) {
      await prisma.householdMember.upsert({
        where: {
          userId_householdId: {
            userId: existingUser.id,
            householdId,
          },
        },
        update: {},
        create: {
          userId: existingUser.id,
          householdId,
          role: 'OWNER',
        },
      });
    }

    return NextResponse.json({ invite });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to create invite:', error);
    return NextResponse.json(
      { error: 'Failed to create invite' },
      { status: 500 }
    );
  }
}
