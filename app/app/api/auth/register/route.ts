import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = registerSchema.parse(body);

    const user = await createUser(email, password, name);

    // Create default household for the user
    const household = await prisma.household.create({
      data: {
        displayName: `${user.name || user.email}'s Household`,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    });

    // Attach user to pending invites for their email
    const now = new Date();
    const pendingInvites = await prisma.invite.findMany({
      where: {
        email,
        expiresAt: {
          gt: now,
        },
        used: {
          lt: prisma.invite.fields.maxUses,
        },
      },
    });

    await Promise.all(
      pendingInvites.map(async (invite) => {
        if (invite.householdId) {
          await prisma.householdMember.upsert({
            where: {
              userId_householdId: {
                userId: user.id,
                householdId: invite.householdId,
              },
            },
            update: {
              role: 'OWNER',
            },
            create: {
              userId: user.id,
              householdId: invite.householdId,
              role: 'OWNER',
            },
          });
        }

        await prisma.invite.update({
          where: { id: invite.id },
          data: {
            used: {
              increment: 1,
            },
          },
        });
      })
    );

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      household: {
        id: household.id,
        displayName: household.displayName,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    );
  }
}
