const LAST_UPDATED = "February 22, 2026";
const EFFECTIVE_DATE = "July 22, 2022";

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-[#199ce0] text-white py-14">
        <div className="max-w-5xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold">
            Refund Policy
          </h1>
          <p className="mt-3 text-white/90">
            Payment and cancellation terms applicable to Yono DMC services.
          </p>
          <p className="mt-2 text-sm text-white/85">
            Last Updated: {LAST_UPDATED} | Effective Date: {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 md:p-9 space-y-8 text-slate-700 leading-7">
          <p>
            As per applicable consumer and e-commerce compliance requirements,
            Yono DMC does not use blanket no-refund language. Refunds and
            settlements are governed by specific, transparent commercial terms
            detailed below.
          </p>

          <section>
            <h2 className="text-3xl font-bold text-slate-900">
              Payment and Cancellation Addendum
            </h2>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-slate-900">
              1. Payment Terms and Disbursement
            </h3>
            <p className="mt-3">
              To ensure guaranteed delivery of travel services, the following
              payment schedule is mandatory:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>
                <strong>1.1 Booking Deposit:</strong> An initial advance payment
                of <strong>25% of the total invoice</strong> is required at the
                time of booking confirmation.
              </li>
              <li>
                <strong>1.2 Interim Payment:</strong> An additional{" "}
                <strong>25% payment</strong> must be remitted no later than{" "}
                <strong>30 days prior to arrival</strong>.
              </li>
              <li>
                <strong>1.3 Final Settlement:</strong> The balance{" "}
                <strong>50% payment</strong> must be cleared by the earlier of:
                <ul className="mt-2 list-disc pl-6 space-y-1">
                  <li>15 days prior to the date of arrival; OR</li>
                  <li>Upon receipt of final service confirmation from Yono DMC.</li>
                </ul>
              </li>
              <li>
                <strong>1.4 Reconfirmation and Blocking:</strong> Rates and
                inventory availability are reconfirmed only upon receipt of the
                stipulated advance. No rooms, vehicles, or services are blocked
                or held without the initial 25% payment.
              </li>
              <li>
                <strong>1.5 Voucher Release:</strong> Official hotel and service
                vouchers are released only upon receipt of{" "}
                <strong>100% of the total contract value</strong>.
              </li>
              <li>
                <strong>1.6 Bank Charges:</strong> All remittance fees,
                intermediary bank charges, and transaction costs are borne by
                the remitting agent/client.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-slate-900">
              2. Cancellation and Credit Note Policy
            </h3>
            <p className="mt-3">
              Cancellations must be received in writing. Retention charges apply
              based on notice period relative to the arrival date.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-900">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Notice Period</th>
                    <th className="px-4 py-3 font-semibold">Cancellation Charge</th>
                    <th className="px-4 py-3 font-semibold">Settlement Method</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium">45+ Days prior</td>
                    <td className="px-4 py-3">10% of Total Value</td>
                    <td className="px-4 py-3">
                      Balance issued via Credit Note (Valid for 12 months)
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium">30-16 Days prior</td>
                    <td className="px-4 py-3">50% of Total Value</td>
                    <td className="px-4 py-3">Balance issued via Credit Note</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium">
                      15 Days or less / No-show
                    </td>
                    <td className="px-4 py-3">100% of Total Value</td>
                    <td className="px-4 py-3">
                      No Refund / No Credit Note applicable
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-slate-900">
              3. Limitations and Provisos
            </h3>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>
                <strong>3.1 Credit Note Validity:</strong> Credit Notes are
                non-transferable and must be utilized within{" "}
                <strong>12 months</strong> from the date of issuance.
              </li>
              <li>
                <strong>3.2 Non-Refundable Clause:</strong> As per standard
                commercial terms, payments made are non-refundable in cash/liquid
                funds and are strictly governed by the Credit Note policy in
                Section 2.
              </li>
              <li>
                <strong>3.3 Prevailing Policies:</strong> Policies for peak
                season, blackout dates, specific events, or restricted supplier
                terms (for example, non-refundable flight/hotel rates) may be
                more stringent. In such cases, the more restrictive policy
                prevails.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-2xl font-semibold text-slate-900">
              Contact for Refund Queries
            </h3>
            <p className="mt-3">
              Email: info@yonodmc.in
              <br />
              Phone: +91 99588 39319
              <br />
              Address: Unit No. 259, 2nd Floor, Tower No. B1, SPAZE ITECH PARK,
              Badshahpur Sohna Rd, Sector 49, Gurugram, Haryana 122018
            </p>
          </section>

          <section>
            <p className="text-sm text-slate-600">Effective Date: 22-07-2022</p>
          </section>
        </div>
      </section>
    </main>
  );
}
