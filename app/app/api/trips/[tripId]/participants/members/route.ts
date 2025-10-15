import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createUserWithRandomPassword } from '@/lib/auth';
import { z } from 'zod';

const createMemberSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  weight: z.number().min(0).max(10).default(1),
});

async function recomputeHouseholdWeight(tripId: string, householdId: string) {
  const participant = await prisma.tripParticipant.findUnique({
    where: {
      tripId_householdId: {
        tripId,
        householdId,
      },
    },
  });

  if (!participant) {
    return;
  }

  const members = await prisma.householdMember.findMany({
    where: { householdId },
    select: { weight: true },
  });

  const totalWeight = members.reduce((sum, member) => sum + (member.weight ?? 0), 0);
  const normalizedWeight = totalWeight > 0 ? totalWeight : 1;

  await prisma.tripParticipant.update({
    where: { id: participant.id },
    data: { weight: normalizedWeight },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const body = await request.json();
    const { householdId, email, name, weight } = createMemberSchema.parse(body);

    const participant = await prisma.tripParticipant.findUnique({
      where: {
        tripId_householdId: {
          tripId,
          householdId,
        },
      },
      include: {
        household: true,
      },
    });

    if (!participant) {
      return NextResponse.json({ error: 'Household is not part of this trip' }, { status: 400 });
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await createUserWithRandomPassword(email, name);
    } else if (!user.name && name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name },
      });
    }

    await prisma.householdMember.upsert({
      where: {
        userId_householdId: {
          userId: user.id,
          householdId,
        },
      },
      update: {
        weight,
      },
      create: {
        userId: user.id,
        householdId,
        weight,
      },
    });

    await recomputeHouseholdWeight(tripId, householdId);

    const updatedParticipant = await prisma.tripParticipant.findUnique({
      where: { id: participant.id },
      include: {
        household: {
          select: {
            id: true,
            displayName: true,
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
                role: true,
                weight: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ participant: updatedParticipant }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to create household member:', error);
    return NextResponse.json(
      { error: 'Failed to create household member' },
      { status: 500 }
    );
  }
}
