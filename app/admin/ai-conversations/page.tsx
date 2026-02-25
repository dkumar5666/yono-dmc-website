"use client";

import { useCallback, useEffect, useState } from "react";

interface ConversationItem {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  detected_intent: string | null;
  status: "new" | "in_progress" | "resolved";
  admin_notes: string | null;
  assigned_to: string | null;
  last_message_at: string;
  message_count: number;
  last_message: string;
}

interface ConversationDetail {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  detected_intent: string | null;
  status: "new" | "in_progress" | "resolved";
  admin_notes: string | null;
  assigned_to: string | null;
  last_message_at: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }>;
}

export default function AdminAIConversationsPage() {
  const [list, setList] = useState<ConversationItem[]>([]);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "in_progress" | "resolved">("all");
  const [workflowStatus, setWorkflowStatus] = useState<"new" | "in_progress" | "resolved">("new");
  const [assignedTo, setAssignedTo] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  const loadList = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai/conversations?status=${statusFilter}`);
      const data = (await response.json()) as {
        data?: { conversations?: ConversationItem[] };
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Failed to load conversations");
      }
      setList(data.data?.conversations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setBusy(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void (async () => {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        window.location.href = "/admin/login";
        return;
      }
      await loadList();
    })();
  }, [loadList]);

  async function openConversation(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai/conversations/${id}`);
      const data = (await response.json()) as {
        data?: { conversation?: ConversationDetail };
        error?: { message?: string };
      };
      if (!response.ok || !data.data?.conversation) {
        throw new Error(data.error?.message ?? "Failed to load conversation detail");
      }
      setSelected(data.data.conversation);
      setWorkflowStatus(data.data.conversation.status);
      setAssignedTo(data.data.conversation.assigned_to ?? "");
      setAdminNotes(data.data.conversation.admin_notes ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation detail");
    } finally {
      setBusy(false);
    }
  }

  async function saveWorkflow() {
    if (!selected) return;
    setSavingWorkflow(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai/conversations/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: workflowStatus,
          assigned_to: assignedTo,
          admin_notes: adminNotes,
        }),
      });
      const data = (await response.json()) as {
        data?: { conversation?: ConversationDetail };
        error?: { message?: string };
      };
      if (!response.ok || !data.data?.conversation) {
        throw new Error(data.error?.message ?? "Failed to save workflow");
      }
      setSelected(data.data.conversation);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save workflow");
    } finally {
      setSavingWorkflow(false);
    }
  }

  function exportCsv() {
    window.open(`/api/admin/ai/conversations?status=${statusFilter}&format=csv`, "_blank");
  }

  return (
      <section className="max-w-7xl mx-auto grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-xl font-semibold">Conversation List</h2>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | "new" | "in_progress" | "resolved")
                }
                className="border rounded-lg px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <button
                type="button"
                onClick={exportCsv}
                className="border rounded-lg px-3 py-1.5 text-sm"
              >
                Export CSV
              </button>
            </div>
          </div>
          {busy && list.length === 0 ? <p className="text-slate-600">Loading...</p> : null}
          {error ? <p className="text-red-700 text-sm mb-2">{error}</p> : null}
          <div className="space-y-2 max-h-[70vh] overflow-auto">
            {list.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openConversation(item.id)}
                className="w-full text-left border rounded-lg p-3 hover:bg-slate-50"
              >
                <p className="font-semibold text-slate-900">
                  {item.customer_name || "Guest User"}{" "}
                  <span className="text-xs text-slate-500">({item.message_count} msgs)</span>
                </p>
                <p className="text-xs mt-1">
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 capitalize">
                    {item.status.replaceAll("_", " ")}
                  </span>
                </p>
                <p className="text-sm text-slate-600">
                  {item.customer_email || item.customer_phone || "No lead shared"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Intent: {item.detected_intent || "unknown"} | Last:{" "}
                  {new Date(item.last_message_at).toLocaleString("en-IN")}
                </p>
                <p className="text-sm text-slate-700 mt-1 line-clamp-2">{item.last_message}</p>
              </button>
            ))}
            {list.length === 0 && !busy ? (
              <p className="text-slate-600 text-sm">No AI conversations yet.</p>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-xl font-semibold mb-3">Conversation Detail</h2>
          {!selected ? (
            <p className="text-slate-600">Select a conversation to view transcript.</p>
          ) : (
            <div>
              <div className="border rounded-lg p-3 mb-3 bg-slate-50">
                <p className="text-sm">
                  <span className="font-semibold">Name:</span>{" "}
                  {selected.customer_name || "Guest User"}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Email:</span>{" "}
                  {selected.customer_email || "-"}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Phone:</span>{" "}
                  {selected.customer_phone || "-"}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Detected intent:</span>{" "}
                  {selected.detected_intent || "unknown"}
                </p>
              </div>
              <div className="border rounded-lg p-3 mb-3 bg-white">
                <h3 className="font-semibold mb-2">Workflow</h3>
                <div className="grid gap-3">
                  <label className="text-sm">
                    <span className="font-medium">Status</span>
                    <select
                      value={workflowStatus}
                      onChange={(e) =>
                        setWorkflowStatus(
                          e.target.value as "new" | "in_progress" | "resolved"
                        )
                      }
                      className="mt-1 w-full border rounded-lg px-2 py-2"
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="font-medium">Assigned To</span>
                    <input
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      placeholder="Agent name"
                      className="mt-1 w-full border rounded-lg px-2 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium">Admin Notes</span>
                    <textarea
                      rows={3}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Internal notes..."
                      className="mt-1 w-full border rounded-lg px-2 py-2"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveWorkflow()}
                    disabled={savingWorkflow}
                    className="justify-self-start rounded-lg bg-blue-700 text-white px-4 py-2 text-sm disabled:opacity-60"
                  >
                    {savingWorkflow ? "Saving..." : "Save Workflow"}
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-[62vh] overflow-auto">
                {selected.messages.map((msg) => (
                  <article
                    key={msg.id}
                    className={`rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-blue-50 border border-blue-100"
                        : "bg-slate-50 border border-slate-200"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">{msg.role}</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(msg.created_at).toLocaleString("en-IN")}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
  );
}
