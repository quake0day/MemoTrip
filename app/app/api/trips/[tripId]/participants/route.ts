import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const addParticipantSchema = z.object({
  householdId: z.string().min(1),
  weight: z.number().min(0).max(2).default(1.0),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;

    const participants = await prisma.tripParticipant.findMany({
      where: { tripId },
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
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ participants });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participants' },
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
    const { householdId, weight } = addParticipantSchema.parse(body);

    // Check if trip exists
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Check if household exists
    const household = await prisma.household.findUnique({
      where: { id: householdId },
    });

    if (!household) {
      return NextResponse.json(
        { error: 'Household not found' },
        { status: 404 }
      );
    }

    // Check if already a participant
    const existing = await prisma.tripParticipant.findUnique({
      where: {
        tripId_householdId: {
          tripId,
          householdId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Household already participating' },
        { status: 400 }
      );
    }

    // Add participant
    const participant = await prisma.tripParticipant.create({
      data: {
        tripId,
        householdId,
        weight,
      },
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
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ participant }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error adding participant:', error);
    return NextResponse.json(
      { error: 'Failed to add participant' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const { searchParams } = new URL(request.url);
    const participantId = searchParams.get('participantId');

    if (!participantId) {
      return NextResponse.json(
        { error: 'Participant ID required' },
        { status: 400 }
      );
    }

    // Delete participant
    await prisma.tripParticipant.delete({
      where: {
        id: participantId,
        tripId, // Ensure the participant belongs to this trip
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing participant:', error);
    return NextResponse.json(
      { error: 'Failed to remove participant' },
      { status: 500 }
    );
  }
}
