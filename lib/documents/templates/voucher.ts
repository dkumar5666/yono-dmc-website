import "server-only";

interface VoucherTemplateInput {
  bookingCode: string;
  customerName: string;
  destination: string;
  travelStartDate: string;
  travelEndDate: string;
  supplierReference: string;
  generatedAt: string;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderVoucherHtml(input: VoucherTemplateInput): string {
  return `
    <html>
      <body style="font-family:Arial,sans-serif;color:#0f172a;padding:24px;">
        <h1 style="margin:0 0 8px 0;color:#0b3a82;">Yono DMC - Booking Confirmation Voucher</h1>
        <p style="margin:0 0 16px 0;color:#334155;">Booking: <strong>${esc(input.bookingCode)}</strong></p>

        <div style="border:1px solid #dbeafe;border-radius:8px;padding:14px;background:#f8fafc;">
          <p style="margin:0 0 8px 0;"><strong>Traveler:</strong> ${esc(input.customerName || "Not available")}</p>
          <p style="margin:0 0 8px 0;"><strong>Destination:</strong> ${esc(input.destination || "Not available")}</p>
          <p style="margin:0 0 8px 0;"><strong>Travel Dates:</strong> ${esc(input.travelStartDate || "-")} to ${esc(input.travelEndDate || "-")}</p>
          <p style="margin:0 0 8px 0;"><strong>Supplier Reference:</strong> ${esc(input.supplierReference || "Pending")}</p>
          <p style="margin:0;"><strong>Generated:</strong> ${esc(input.generatedAt)}</p>
        </div>

        <p style="margin-top:18px;color:#475569;font-size:13px;">
          Present this voucher at check-in and during local service confirmations.
        </p>
      </body>
    </html>
  `;
}
