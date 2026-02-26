"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

type SupportCategory = "voucher" | "payment" | "cancellation" | "change" | "other";

interface Props {
  bookingId: string;
  backHref: string;
}

function initialSubject(bookingId: string): string {
  return `Support request for booking ${bookingId}`;
}

export default function TripSupportRequestForm({ bookingId, backHref }: Props) {
  const [category, setCategory] = useState<SupportCategory>("other");
  const [subject, setSubject] = useState(initialSubject(bookingId));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const isValid = useMemo(
    () => subject.trim().length >= 3 && message.trim().length >= 10,
    [subject, message]
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccessId(null);

    try {
      const response = await fetch("/api/support-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          category,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { ok?: boolean; id?: string };
        error?: { message?: string } | string;
      };

      if (!response.ok) {
        const msg =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message || `Failed to submit request (${response.status})`;
        throw new Error(msg);
      }

      setSuccessId(payload.data?.id ?? "submitted");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit support request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Create Support Request</h2>
        <p className="mt-1 text-xs text-slate-500">
          Raise a ticket linked to this booking. Our team will review and respond.
        </p>
      </div>

      {successId ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
          Support request submitted successfully.
          <div className="mt-1 text-xs">Reference: {successId}</div>
          <div className="mt-3">
            <Link href={backHref} className="font-semibold underline">
              Back to booking details
            </Link>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SupportCategory)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
          >
            <option value="voucher">Voucher</option>
            <option value="payment">Payment</option>
            <option value="cancellation">Cancellation</option>
            <option value="change">Change</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary of your issue"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
          />
          <p className="mt-1 text-xs text-slate-400">Minimum 3 characters</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            placeholder="Describe your issue in detail so our support team can help quickly."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
          />
          <p className="mt-1 text-xs text-slate-400">Minimum 10 characters</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!isValid || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#148bc7] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit Request
          </button>
          <Link
            href={backHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

