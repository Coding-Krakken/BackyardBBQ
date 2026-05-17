import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { evaluateCorrelationContract } from "@/lib/integrations/correlation-contract";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const correlationId = params.id?.trim();
  if (!correlationId) {
    return NextResponse.json({ message: "Missing correlation ID" }, { status: 400 });
  }

  const where: Prisma.IntegrationEventWhereInput = {
    payload: {
      path: ["correlationId"],
      equals: correlationId
    }
  };

  const events = await prisma.integrationEvent.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 2000,
    select: {
      id: true,
      channel: true,
      eventType: true,
      status: true,
      createdAt: true,
      payload: true
    }
  });

  const contract = evaluateCorrelationContract(events, correlationId);

  return NextResponse.json({
    correlationId,
    ...contract
  });
}
