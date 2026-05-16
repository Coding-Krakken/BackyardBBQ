"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { RoleGate } from "@/components/RoleGate";
import { AnimatedPage } from "@/components/AnimatedPage";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fetcher, formatCurrency, formatDate } from "@/lib/utils";

interface DisputeDetail {
  id: string;
  eventType: string;
  status: string;
  createdAt: string;
  disputeId: string | null;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
  reason: string;
  disputeStatus: string;
  evidence: {
    customerName?: string;
    customerEmail?: string;
    orderDetails?: string;
    shippingTrackingNumber?: string;
    uncategorizedText?: string;
    submittedAt?: string;
  } | null;
  dueBy: string | null;
  updatedAt: string | null;
}

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formState, setFormState] = useState({
    customerName: "",
    customerEmail: "",
    orderDetails: "",
    shippingTrackingNumber: "",
    uncategorizedText: "",
  });

  const paramId = params?.id;
  const disputeId = Array.isArray(paramId) ? paramId[0] : paramId;

  const { data, isLoading, mutate } = useSWR<{ data: DisputeDetail }>(
    disputeId ? `/api/admin/payments/disputes/${disputeId}` : null,
    fetcher
  );

  const submitEvidence = async () => {
    if (!disputeId) {
      return;
    }

    if (formState.uncategorizedText.trim().length < 10) {
      addToast({ type: "error", message: "Evidence summary must be at least 10 characters" });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set("customerName", formState.customerName);
      formData.set("customerEmail", formState.customerEmail);
      formData.set("orderDetails", formState.orderDetails);
      formData.set("shippingTrackingNumber", formState.shippingTrackingNumber);
      formData.set("uncategorizedText", formState.uncategorizedText);
      for (const file of selectedFiles) {
        formData.append("evidenceFiles", file);
      }

      const response = await fetch(`/api/admin/payments/disputes/${disputeId}/evidence`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        addToast({ type: "error", message: payload.message ?? "Failed to submit evidence" });
        return;
      }

      addToast({ type: "success", message: "Evidence submitted" });
      setFormState({
        customerName: "",
        customerEmail: "",
        orderDetails: "",
        shippingTrackingNumber: "",
        uncategorizedText: "",
      });
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await mutate();
    } catch {
      addToast({ type: "error", message: "An error occurred" });
    } finally {
      setIsSaving(false);
    }
  };

  const markReviewed = async () => {
    if (!disputeId) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/payments/disputes/${disputeId}/review`, {
        method: "PATCH",
      });
      if (!response.ok) {
        addToast({ type: "error", message: "Failed to mark dispute as reviewed" });
        return;
      }

      addToast({ type: "success", message: "Dispute marked as reviewed" });
      await mutate();
    } catch {
      addToast({ type: "error", message: "An error occurred" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <RoleGate allowedRoles={["owner", "admin", "accounting"]}>
      <AnimatedPage>
        <PageHeader
          title="Dispute Details"
          subtitle="Review dispute metadata and submit evidence"
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => router.push("/dashboard/payments")}>Back to Payments</button>
          }
        />

        {isLoading ? (
          <div className="panel">
            <p className="text-muted">Loading dispute...</p>
          </div>
        ) : !data?.data ? (
          <div className="panel">
            <p className="text-muted">Dispute not found.</p>
          </div>
        ) : (
          <>
            <div className="panel mb-lg">
              <div className="grid-cards grid-cards-2">
                <div>
                  <p className="text-muted">Dispute ID</p>
                  <p><strong>{data.data.disputeId ?? "N/A"}</strong></p>
                </div>
                <div>
                  <p className="text-muted">Status</p>
                  <StatusBadge status={data.data.disputeStatus || data.data.status} />
                </div>
                <div>
                  <p className="text-muted">Amount</p>
                  <p><strong>{formatCurrency(data.data.amountCents)}</strong></p>
                </div>
                <div>
                  <p className="text-muted">Reason</p>
                  <p><strong>{data.data.reason}</strong></p>
                </div>
                <div>
                  <p className="text-muted">Created</p>
                  <p>{formatDate(data.data.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted">Due By</p>
                  <p>{data.data.dueBy ? formatDate(data.data.dueBy) : "N/A"}</p>
                </div>
              </div>

              <div className="mt-lg">
                <button className="btn btn-primary btn-sm" onClick={markReviewed} disabled={isSaving}>
                  {isSaving ? "Processing..." : "Mark Reviewed"}
                </button>
              </div>
            </div>

            {data.data.evidence && (
              <div className="panel mb-lg">
                <h3 className="mb-sm">Evidence Timeline</h3>
                <p className="text-muted mb-sm">
                  Last evidence submission: {data.data.evidence.submittedAt ? formatDate(data.data.evidence.submittedAt) : "Unknown"}
                </p>
                <pre className="code-block" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
{JSON.stringify(data.data.evidence, null, 2)}
                </pre>
              </div>
            )}

            <div className="panel">
              <h3 className="mb-md">Submit Evidence</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input
                    className="input"
                    value={formState.customerName}
                    onChange={(event) => setFormState({ ...formState, customerName: event.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Email</label>
                  <input
                    className="input"
                    type="email"
                    value={formState.customerEmail}
                    onChange={(event) => setFormState({ ...formState, customerEmail: event.target.value })}
                  />
                </div>
              </div>

              <label className="form-label">Shipping Tracking #</label>
              <input
                className="input"
                value={formState.shippingTrackingNumber}
                onChange={(event) => setFormState({ ...formState, shippingTrackingNumber: event.target.value })}
              />

              <label className="form-label" style={{ marginTop: "0.75rem" }}>Order Details</label>
              <textarea
                className="textarea"
                rows={3}
                value={formState.orderDetails}
                onChange={(event) => setFormState({ ...formState, orderDetails: event.target.value })}
              />

              <label className="form-label" style={{ marginTop: "0.75rem" }}>Evidence Summary</label>
              <textarea
                className="textarea"
                rows={5}
                value={formState.uncategorizedText}
                onChange={(event) => setFormState({ ...formState, uncategorizedText: event.target.value })}
              />

              <label className="form-label" style={{ marginTop: "0.75rem" }}>Evidence Files (optional)</label>
              <input
                ref={fileInputRef}
                className="input"
                type="file"
                multiple
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  setSelectedFiles(files);
                }}
              />
              {selectedFiles.length > 0 ? (
                <p className="text-muted" style={{ marginTop: "0.5rem" }}>
                  {selectedFiles.length} file(s) selected.
                </p>
              ) : null}

              <div className="modal-actions">
                <button className="btn btn-primary btn-sm" onClick={submitEvidence} disabled={isSaving}>
                  {isSaving ? "Submitting..." : "Submit Evidence to Stripe"}
                </button>
              </div>
            </div>
          </>
        )}
      </AnimatedPage>
    </RoleGate>
  );
}
