import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider, unsupportedProviderMessage } from "@/lib/payment-provider";

const evidenceSchema = z.object({
  customerName: z.string().trim().max(120).optional(),
  customerEmail: z.string().email().optional(),
  orderDetails: z.string().trim().max(2000).optional(),
  shippingTrackingNumber: z.string().trim().max(120).optional(),
  uncategorizedText: z.string().trim().min(10).max(5000),
});

type EvidenceInput = z.infer<typeof evidenceSchema>;

function toOptionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

async function parseEvidencePayload(request: NextRequest): Promise<{
  parsed: ReturnType<typeof evidenceSchema.safeParse>;
  files: File[];
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload = {
      customerName: toOptionalString(formData.get("customerName")),
      customerEmail: toOptionalString(formData.get("customerEmail")),
      orderDetails: toOptionalString(formData.get("orderDetails")),
      shippingTrackingNumber: toOptionalString(formData.get("shippingTrackingNumber")),
      uncategorizedText: toOptionalString(formData.get("uncategorizedText")) ?? "",
    };

    const files = formData
      .getAll("evidenceFiles")
      .filter(
        (value): value is File =>
          typeof value === "object" &&
          value !== null &&
          "arrayBuffer" in value &&
          "name" in value
      );

    return {
      parsed: evidenceSchema.safeParse(payload),
      files,
    };
  }

  const jsonBody = (await request.json().catch(() => ({}))) as EvidenceInput;
  return {
    parsed: evidenceSchema.safeParse(jsonBody),
    files: [],
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(["owner", "admin", "accounting"]);
  if (auth instanceof NextResponse) return auth;

  const provider = getPaymentProvider();

  const { parsed, files } = await parseEvidencePayload(request);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid evidence payload", errors: parsed.error.flatten() }, { status: 400 });
  }

  const event = await prisma.integrationEvent.findUnique({
    where: { id: params.id },
  });

  if (!event || !event.eventType.includes("dispute")) {
    return NextResponse.json({ message: "Dispute event not found" }, { status: 404 });
  }

  const previousPayload = (event.payload ?? {}) as Record<string, unknown>;

  if (provider === "epos") {
    const updated = await prisma.integrationEvent.update({
      where: { id: params.id },
      data: {
        status: "evidence_submitted",
        payload: {
          ...previousPayload,
          provider,
          disputeStatus: "evidence_submitted",
          evidence: {
            ...parsed.data,
            fileCount: files.length,
            submittedAt: new Date().toISOString(),
            instructions:
              "Attach this evidence manually in EPOS support/back-office dispute workflow.",
          },
        },
      },
    });

    return NextResponse.json({
      data: updated,
      message:
        "Evidence recorded for manual EPOS dispute handling.",
    });
  }

  return NextResponse.json(
    { message: unsupportedProviderMessage("/api/admin/payments/disputes/[id]/evidence") },
    { status: 501 }
  );
}
