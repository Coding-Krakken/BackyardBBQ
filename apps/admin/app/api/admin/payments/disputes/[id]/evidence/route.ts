import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/requireAdmin";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

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

  if (!stripe) {
    return NextResponse.json({ message: "Stripe is not configured" }, { status: 500 });
  }

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

  const disputeId =
    typeof previousPayload.disputeId === "string" && previousPayload.disputeId
      ? previousPayload.disputeId
      : null;

  if (!disputeId) {
    return NextResponse.json({ message: "Dispute ID is missing from event payload" }, { status: 400 });
  }

  const evidence: {
    customer_name?: string;
    customer_email_address?: string;
    product_description?: string;
    shipping_tracking_number?: string;
    uncategorized_text?: string;
    uncategorized_file?: string;
  } = {};

  if (parsed.data.customerName) {
    evidence.customer_name = parsed.data.customerName;
  }
  if (parsed.data.customerEmail) {
    evidence.customer_email_address = parsed.data.customerEmail;
  }
  if (parsed.data.orderDetails) {
    evidence.product_description = parsed.data.orderDetails;
  }
  if (parsed.data.shippingTrackingNumber) {
    evidence.shipping_tracking_number = parsed.data.shippingTrackingNumber;
  }
  if (parsed.data.uncategorizedText) {
    evidence.uncategorized_text = parsed.data.uncategorizedText;
  }

  const uploadedFileIds: string[] = [];

  for (const file of files.slice(0, 3)) {
    if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
      continue;
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await stripe.files.create({
      purpose: "dispute_evidence",
      file: {
        data: bytes,
        name: file.name || `evidence-${Date.now()}.bin`,
        type: file.type || "application/octet-stream",
      },
    });

    uploadedFileIds.push(uploaded.id);
  }

  if (uploadedFileIds.length > 0) {
    evidence.uncategorized_file = uploadedFileIds[0];
  }

  let updatedDisputeStatus = "under_review";

  try {
    const dispute = await stripe.disputes.update(disputeId, {
      evidence,
      submit: true,
    });
    updatedDisputeStatus = dispute.status;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit evidence to Stripe";
    return NextResponse.json({ message }, { status: 502 });
  }

  const updated = await prisma.integrationEvent.update({
    where: { id: params.id },
    data: {
      status: updatedDisputeStatus,
      payload: {
        ...previousPayload,
        disputeStatus: updatedDisputeStatus,
        evidence: {
          ...parsed.data,
          uploadedFileIds,
          submittedAt: new Date().toISOString(),
        },
      },
    },
  });

  return NextResponse.json({ data: updated });
}
