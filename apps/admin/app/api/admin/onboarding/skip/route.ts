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
      skippedAt: new Date(),
      tourVersion: featureStatusConfig.version,
      completedSteps: [],
    },
    update: {
      skippedAt: new Date(),
    },
  });

  return NextResponse.json({ progress });
}
