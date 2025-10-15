import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateSettlementSchema = z.object({
  tableJson: z.any().optional(),
  transfersJson: z.array(z.any()).optional(),
  locked: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; settlementId: string }> }
) {
  try {
    const { tripId, settlementId } = await params;
    const body = await request.json();
    const payload = updateSettlementSchema.parse(body);

    const settlement = await prisma.settlement.findFirst({
      where: {
        id: settlementId,
        tripId,
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const updated = await prisma.settlement.update({
      where: { id: settlementId },
      data: {
        tableJson: payload.tableJson ?? settlement.tableJson,
        transfersJson: payload.transfersJson ?? settlement.transfersJson,
        locked: payload.locked ?? settlement.locked,
      },
    });

    return NextResponse.json({ settlement: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Failed to update settlement:', error);
    return NextResponse.json(
      { error: 'Failed to update settlement' },
      { status: 500 }
    );
  }
}
