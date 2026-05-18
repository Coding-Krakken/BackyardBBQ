import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { prisma } from '@/lib/prisma';
import featureStatusConfig from '@/config/feature-status.json';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const userId = (auth.session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const progress = await prisma.onboardingProgress.findUnique({
    where: { customerId: userId },
  });

  return NextResponse.json({
    progress: progress ?? null,
    featureConfig: featureStatusConfig,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const userId = (auth.session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { completedSteps, lastStepSeen } = body;

  const progress = await prisma.onboardingProgress.upsert({
    where: { customerId: userId },
    create: {
      customerId: userId,
      completedSteps: completedSteps ?? [],
      lastStepSeen: lastStepSeen ?? null,
      tourVersion: featureStatusConfig.version,
    },
    update: {
      completedSteps: completedSteps ?? undefined,
      lastStepSeen: lastStepSeen ?? undefined,
    },
  });

  return NextResponse.json({ progress });
}
