import "server-only";

interface InvoiceTemplateInput {
  bookingCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  currency: string;
  createdAt: string;
  items: Array<{
    title: string;
    type: string;
    amount: number;
    currency: string;
  }>;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function money(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return "Not available";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function renderInvoiceHtml(input: InvoiceTemplateInput): string {
  const rows = input.items
    .map(
      (item, index) => `
        <tr>
          <td style="padding:8px;border:1px solid #dbeafe;">${index + 1}</td>
          <td style="padding:8px;border:1px solid #dbeafe;">${esc(item.type || "-")}</td>
          <td style="padding:8px;border:1px solid #dbeafe;">${esc(item.title || "-")}</td>
          <td style="padding:8px;border:1px solid #dbeafe;text-align:right;">${money(item.amount, item.currency)}</td>
        </tr>`
    )
    .join("");

  return `
    <html>
      <body style="font-family:Arial,sans-serif;color:#0f172a;padding:24px;">
        <h1 style="margin:0 0 8px 0;color:#0b3a82;">Yono DMC - Invoice</h1>
        <p style="margin:0 0 16px 0;color:#334155;">Booking: <strong>${esc(input.bookingCode)}</strong></p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td style="padding:6px 0;"><strong>Customer</strong></td>
            <td style="padding:6px 0;">${esc(input.customerName || "Not available")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;"><strong>Email</strong></td>
            <td style="padding:6px 0;">${esc(input.customerEmail || "Not available")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;"><strong>Phone</strong></td>
            <td style="padding:6px 0;">${esc(input.customerPhone || "Not available")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;"><strong>Generated</strong></td>
            <td style="padding:6px 0;">${esc(input.createdAt)}</td>
          </tr>
        </table>

        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead>
            <tr style="background:#eff6ff;">
              <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">#</th>
              <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">Type</th>
              <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">Item</th>
              <th style="padding:8px;border:1px solid #dbeafe;text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="4" style="padding:10px;border:1px solid #dbeafe;">No booking items available</td></tr>`}
          </tbody>
        </table>

        <p style="font-size:18px;font-weight:700;margin-top:18px;">
          Total: ${money(input.amount, input.currency)}
        </p>
      </body>
    </html>
  `;
}
