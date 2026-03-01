import Link from "next/link";
import { CalendarClock, ClipboardCheck, Clock3 } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import {
  listSupplierAssignments,
  resolveBookingByReference,
  resolveSupplierIdentityByUserId,
} from "@/lib/supplier/assignmentResolver";

export const dynamic = "force-dynamic";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeDate(value: unknown): Date | null {
  const text = safeString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isPending(value: string | null): boolean {
  const status = safeString(value).toLowerCase();
  if (!status) return true;
  return status.includes("pending") || status.includes("new");
}

export default async function SupplierDashboardPage() {
  const identity = await requireRole("supplier", "/supplier/dashboard");

  let dueToday = 0;
  let dueThisWeek = 0;
  let pendingConfirmation = 0;
  let upcoming: Array<{
    booking_id: string;
    status: string | null;
    due_at: string | null;
    payment_status: string | null;
  }> = [];

  try {
    const db = new SupabaseRestClient();
    const supplier = await resolveSupplierIdentityByUserId(db, identity.userId);
    if (supplier?.supplierId) {
      const assignments = await listSupplierAssignments(db, supplier.supplierId);
      const grouped = new Map<string, { statuses: string[]; starts: string[] }>();

      for (const item of assignments) {
        const bookingRef = safeString(item.booking_id);
        if (!bookingRef) continue;
        const current = grouped.get(bookingRef) ?? { statuses: [], starts: [] };
        if (item.status) current.statuses.push(item.status);
        if (item.start_at) current.starts.push(item.start_at);
        grouped.set(bookingRef, current);
      }

      const bookingRefs = Array.from(grouped.keys()).slice(0, 120);
      const bookingRows = await Promise.all(
        bookingRefs.map(async (ref) => ({ ref, row: await resolveBookingByReference(db, ref) }))
      );

      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const todayKey = now.toDateString();

      upcoming = bookingRows
        .map(({ ref, row }) => {
          const bookingId = safeString(row?.booking_code) || safeString(row?.id) || ref;
          const assignment = grouped.get(ref);
          const dueDateCandidate = assignment?.starts?.[0] || safeString(row?.travel_start_date);
          const due = safeDate(dueDateCandidate)?.toISOString() || null;
          const statuses = [
            ...(assignment?.statuses ?? []),
            safeString(row?.supplier_status),
            safeString(row?.lifecycle_status),
          ]
            .map((value) => value.trim())
            .filter(Boolean);

          const status = statuses[0] || null;
          if (isPending(status)) pendingConfirmation += 1;

          const dueDate = safeDate(due);
          if (dueDate) {
            if (dueDate.toDateString() === todayKey) dueToday += 1;
            if (dueDate >= now && dueDate <= weekEnd) dueThisWeek += 1;
          }

          return {
            booking_id: bookingId,
            status,
            payment_status: safeString(row?.payment_status) || null,
            due_at: due,
          };
        })
        .sort((a, b) => {
          const ta = safeDate(a.due_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const tb = safeDate(b.due_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return ta - tb;
        })
        .slice(0, 12);
    }
  } catch (error) {
    if (!(error instanceof SupabaseNotConfiguredError)) {
      // silent fallback to empty cards
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#199ce0]">Supplier Portal</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Welcome, {identity.fullName || "Partner"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Assigned services for your team. Use bookings to confirm, complete, and upload invoices.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Due Today</p>
            <CalendarClock className="h-4 w-4 text-[#199ce0]" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dueToday}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Due This Week</p>
            <Clock3 className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dueThisWeek}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Pending Confirmation</p>
            <ClipboardCheck className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{pendingConfirmation}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Upcoming Assigned Bookings</h2>
            <p className="text-xs text-slate-500">Next operational services to fulfill.</p>
          </div>
          <Link
            href="/supplier/bookings"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-300"
          >
            View all bookings
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No assigned bookings found yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Booking</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Payment</th>
                  <th className="px-3 py-3 font-semibold">Due</th>
                  <th className="px-3 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((row) => (
                  <tr key={row.booking_id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-900">{row.booking_id}</td>
                    <td className="px-3 py-3 text-slate-600">{row.status || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">{row.payment_status || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(row.due_at)}</td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/supplier/bookings/${encodeURIComponent(row.booking_id)}`}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
