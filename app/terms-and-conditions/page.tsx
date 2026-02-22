const LAST_UPDATED = "February 22, 2026";
const EFFECTIVE_DATE = "July 22, 2022";
const REGISTERED_OFFICE =
  "Unit No. 259, 2nd Floor, Tower No. B1, SPAZE ITECH PARK, Badshahpur Sohna Rd, Sector 49, Gurugram, Haryana 122018";

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-[#199ce0] text-white py-14">
        <div className="max-w-5xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold">Terms and Conditions</h1>
          <p className="mt-3 text-white/90">
            These terms govern your use of Yono DMC website and travel services.
          </p>
          <p className="mt-2 text-sm text-white/85">
            Last Updated: {LAST_UPDATED} | Effective Date: {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 md:p-9 space-y-8 text-slate-700 leading-7">
          <p>
            Welcome to <strong>Yono DMC</strong>. These Terms and Conditions
            (&quot;Terms&quot;) govern your use of our website{" "}
            <strong>https://www.yonodmc.in</strong> and the purchase of travel
            services, tour packages, and hotel bookings (the &quot;Services&quot;)
            provided by Yono DMC (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot;
            or &quot;our&quot;).
          </p>
          <p>
            By accessing our platform or booking a service, you agree to be
            bound by these Terms. If you are a B2B partner or travel agent,
            these Terms apply to your agency and the end-travelers you
            represent.
          </p>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              1. Scope of Services
            </h2>
            <p className="mt-3">
              Yono DMC operates as a Destination Management Company (DMC) and
              Online Travel Agency (OTA). We facilitate bookings for:
            </p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>Inbound and outbound tour packages</li>
              <li>Hotel and accommodation reservations</li>
              <li>Ground transportation and logistics</li>
              <li>B2B travel inventory access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              2. Booking and Confirmation
            </h2>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>
                <strong>2.1 Accuracy of Information:</strong> You are
                responsible for providing accurate traveler details (names as
                per passport, contact info). Yono DMC is not liable for errors
                resulting from incorrect data provided by the user.
              </li>
              <li>
                <strong>2.2 Booking Status:</strong> A booking is considered
                confirmed only after issuance of a confirmation voucher and
                receipt of the required payment.
              </li>
              <li>
                <strong>2.3 Identification:</strong> For international travel,
                travelers must possess a passport valid for at least six months
                from the date of travel and requisite visas.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              3. Pricing and Payment
            </h2>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>
                <strong>3.1 Currency:</strong> All prices are quoted in the
                currency specified at the time of booking (typically INR or
                USD).
              </li>
              <li>
                <strong>3.2 Price Fluctuations:</strong> Prices are subject to
                change based on availability, government taxes, or fuel
                surcharges until the booking is fully paid.
              </li>
              <li>
                <strong>3.3 Payment Schedule:</strong> Full payment or a
                specified deposit must be made at the time of booking as per the
                specific package policy.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              4. Cancellation and Refund Policy
            </h2>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>
                <strong>4.1 Service Provider Policies:</strong> Cancellations
                are subject to the specific terms of third-party providers
                (Hotels, Airlines, Transporters).
              </li>
              <li>
                <strong>4.2 Standard Cancellation Fees:</strong>
                <ul className="mt-2 list-disc pl-6 space-y-1">
                  <li>30+ days prior to departure: 25% of total cost</li>
                  <li>15-29 days prior to departure: 50% of total cost</li>
                  <li>Within 14 days of departure: 100% cancellation fee</li>
                </ul>
              </li>
              <li>
                <strong>4.3 Non-Refundable Components:</strong> Certain flight
                tickets, peak-season hotel bookings, and special events may be
                100% non-refundable from the time of booking.
              </li>
              <li>
                <strong>4.4 Refund Timeline:</strong> Processed refunds are
                credited back to the original payment source within 7-14 working
                days.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              5. Amendments and Changes
            </h2>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>
                <strong>5.1 User Request:</strong> Any change in travel dates or
                itinerary requested after confirmation attracts amendment charges
                plus any fare/rate difference.
              </li>
              <li>
                <strong>5.2 Company Change:</strong> Yono DMC reserves the right
                to modify itineraries due to unforeseen circumstances (weather,
                safety, local strikes). In such cases, an equivalent alternative
                is provided.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              6. Limitation of Liability
            </h2>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>
                <strong>6.1 Third-Party Acts:</strong> Yono DMC acts as a
                facilitator between traveler and service providers. We are not
                liable for acts, errors, omissions, or negligence of third-party
                suppliers.
              </li>
              <li>
                <strong>6.2 Force Majeure:</strong> We are not liable for
                failure to perform obligations due to events beyond control,
                including natural disasters, pandemics, war, or government
                restrictions.
              </li>
              <li>
                <strong>6.3 Personal Injury/Loss:</strong> Travelers are advised
                to obtain comprehensive travel insurance. Yono DMC is not
                responsible for theft, injury, or loss of life during travel.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              7. User Obligations and Conduct
            </h2>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>
                You agree to comply with local laws and regulations of the
                destination country.
              </li>
              <li>
                You shall not use our platform for fraudulent bookings or
                speculative reservations.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              8. Intellectual Property
            </h2>
            <p className="mt-3">
              All content on <strong>https://www.yonodmc.in</strong>, including
              text, logos, and software, is the property of Yono DMC and is
              protected by copyright laws. Unauthorized use is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              9. Governing Law and Jurisdiction
            </h2>
            <p className="mt-3">
              These Terms are governed by the laws of India. Any disputes
              arising out of these Terms are subject to the exclusive
              jurisdiction of the courts in Gurugram, Haryana, India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              10. Contact Us
            </h2>
            <p className="mt-3">
              For questions regarding these Terms or your bookings:
              <br />
              <strong>Email:</strong> info@yonodmc.in
              <br />
              <strong>Address:</strong> {REGISTERED_OFFICE}
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

