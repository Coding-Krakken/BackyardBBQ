import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { prisma } from '@/lib/prisma';
import featureStatusConfig from '@/config/feature-status.json';

export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const userId = (auth.session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const progress = await prisma.onboardingProgress.upsert({
    where: { customerId: userId },
    create: {
      customerId: userId,
      completedSteps: [],
      tourVersion: featureStatusConfig.version,
    },
    update: {
      completedAt: null,
      skippedAt: null,
      completedSteps: [],
      lastStepSeen: null,
      tourVersion: featureStatusConfig.version,
    },
  });

  return NextResponse.json({ progress });
}
