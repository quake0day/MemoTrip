import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateSettlement } from '@/lib/settlement';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;

    // Get all receipts with parsed data
    const receipts = await prisma.receipt.findMany({
      where: {
        tripId,
        status: { in: ['PARSED', 'REVIEWED'] },
      },
    });

    // Get participants
    const participants = await prisma.tripParticipant.findMany({
      where: { tripId },
      include: {
        household: true,
      },
    });

    if (participants.length === 0) {
      return NextResponse.json(
        { error: 'No participants in trip' },
        { status: 400 }
      );
    }

    // Transform receipts for calculation
    const receiptData = receipts.map(r => {
      const data = (r.manualEditsJson || r.parsedJson) as any;
      return {
        id: r.id,
        grandTotal: data?.grandTotal || 0,
        category: data?.category || 'Other',
        paidBy: data?.paidBy || participants[0].householdId,
        participants: data?.participants || participants.map(p => p.householdId),
      };
    });

    const participantData = participants.map(p => ({
      householdId: p.householdId,
      householdName: p.household.displayName,
      weight: p.weight,
    }));

    // Calculate settlement
    const settlementData = calculateSettlement(receiptData, participantData);

    // Get next version number
    const latestSettlement = await prisma.settlement.findFirst({
      where: { tripId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latestSettlement?.version || 0) + 1;

    // Create new settlement
    const settlement = await prisma.settlement.create({
      data: {
        tripId,
        version: nextVersion,
        tableJson: {
          households: settlementData.households,
          categories: settlementData.categories,
          totalWeight: settlementData.totalWeight,
        } as any,
        transfersJson: settlementData.transfers as any,
      },
    });

    return NextResponse.json({ settlement }, { status: 201 });
  } catch (error) {
    console.error('Recompute settlement error:', error);
    return NextResponse.json(
      { error: 'Failed to recompute settlement' },
      { status: 500 }
    );
  }
}
