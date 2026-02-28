"use client";

import { useState } from "react";

interface RequestActionsProps {
  requestId: string;
  status: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default function SupplierRequestActions({ requestId, status }: RequestActionsProps) {
  const [rejectReason, setRejectReason] = useState("");
  const [loadingAction, setLoadingAction] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approveRequest() {
    if (loadingAction) return;
    setLoadingAction("approve");
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/suppliers/requests/${encodeURIComponent(requestId)}/approve`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: {
          supplier_id?: string;
          recovery_link_sent?: boolean;
        };
        error?: { message?: string };
        message?: string;
      };
      if (!response.ok) {
        throw new Error(safeString(payload.error?.message) || safeString(payload.message) || "Approve failed");
      }
      setMessage(
        `Approved successfully. Supplier ID: ${safeString(payload.data?.supplier_id) || "created"}${
          payload.data?.recovery_link_sent ? " (login setup link sent)." : ""
        }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setLoadingAction(null);
    }
  }

  async function rejectRequest() {
    if (loadingAction) return;
    if (!rejectReason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setLoadingAction("reject");
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/suppliers/requests/${encodeURIComponent(requestId)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        message?: string;
      };
      if (!response.ok) {
        throw new Error(safeString(payload.error?.message) || safeString(payload.message) || "Reject failed");
      }
      setMessage("Request rejected successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setLoadingAction(null);
    }
  }

  const isClosed = status === "approved" || status === "rejected";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void approveRequest()}
          disabled={Boolean(loadingAction) || isClosed}
          className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loadingAction === "approve" ? "Approving..." : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => void rejectRequest()}
          disabled={Boolean(loadingAction) || isClosed}
          className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
        >
          {loadingAction === "reject" ? "Rejecting..." : "Reject"}
        </button>
      </div>
      <textarea
        value={rejectReason}
        onChange={(event) => setRejectReason(event.target.value)}
        placeholder="Rejection reason (required for reject)"
        rows={3}
        disabled={isClosed}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0] disabled:bg-slate-50"
      />
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
    </div>
  );
}
