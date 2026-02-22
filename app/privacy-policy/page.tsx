const LAST_UPDATED = "February 22, 2026";
const EFFECTIVE_DATE = "July 22, 2022";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-[#199ce0] text-white py-14">
        <div className="max-w-5xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold">Privacy Policy</h1>
          <p className="mt-3 text-white/90">
            This Privacy Policy outlines how Yono DMC collects, uses, discloses,
            and protects personal data of users, travelers, and B2B partners.
          </p>
          <p className="mt-2 text-sm text-white/85">
            Last Updated: {LAST_UPDATED} | Effective Date: {EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 md:p-9 space-y-8 text-slate-700 leading-7">
          <p>
            This Privacy Policy (&quot;Policy&quot;) outlines the practices of <strong>Yono DMC</strong>
            (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) regarding the collection, use,
            disclosure, and protection of personal data belonging to our users,
            travelers, and B2B partners (&quot;you&quot; or &quot;your&quot;).
          </p>

          <p>
            As a travel technology company and Online Travel Agency (OTA)
            operating primarily from India with an international clientele, we
            are committed to processing data in compliance with the <strong>Digital
            Personal Data Protection Act, 2023 (India)</strong>, the <strong>General Data
            Protection Regulation (GDPR)</strong>, and other applicable global privacy
            frameworks including <strong>CCPA/CPRA</strong> where relevant.
          </p>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">1. Definitions</h2>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li><strong>Personal Data:</strong> Any information that relates to an identified or identifiable individual.</li>
              <li><strong>Data Principal/Data Subject:</strong> The individual to whom the personal data relates.</li>
              <li><strong>Processing:</strong> Any operation performed on personal data, such as collection, storage, use, or sharing.</li>
              <li><strong>DMC Services:</strong> Destination Management Company services, including local ground handling and logistics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">2. Information We Collect</h2>
            <p className="mt-3">To provide comprehensive travel and OTA services, we collect the following categories of data:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li><strong>2.1 Personal Identifiers:</strong> Full name, gender, date of birth, and nationality.</li>
              <li><strong>2.2 Contact Information:</strong> Email address, telephone number, and physical billing address.</li>
              <li><strong>2.3 Travel Documentation:</strong> Passport details (number, expiry date, place of issue) and visa information as required by international travel regulations and government authorities.</li>
              <li><strong>2.4 Financial &amp; Billing Data:</strong> Credit/debit card masked digits, billing preferences, and transaction history. <em>Note: Full payment card processing is handled by PCI-DSS compliant third-party gateways.</em></li>
              <li><strong>2.5 Technical &amp; Usage Data:</strong> IP address, browser type, device information, operating system, and interaction data via cookies and analytics.</li>
              <li><strong>2.6 Booking Preferences:</strong> Dietary requirements, medical needs (if relevant to travel safety), and specific accommodation or transport preferences.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">3. How We Collect Data</h2>
            <p className="mt-3">We collect data through the following channels:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li><strong>Direct Interaction:</strong> Information provided when you fill out inquiry forms, register a B2B account, or complete a booking on https://www.yonodmc.in.</li>
              <li><strong>Automated Technologies:</strong> Cookies, server logs, and tracking pixels used during your website visit.</li>
              <li><strong>Third Parties:</strong> Data received from travel agents, corporate partners, or GDS (Global Distribution Systems).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">4. Purpose of Data Processing</h2>
            <p className="mt-3">We process your data for the following legitimate business purposes:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li><strong>Fulfillment of Contract:</strong> To process bookings, issue tickets, and confirm hotel reservations.</li>
              <li><strong>Customer Support:</strong> To communicate updates, itinerary changes, and respond to queries.</li>
              <li><strong>Safety and Security:</strong> For identity verification and fraud prevention.</li>
              <li><strong>Marketing:</strong> To send newsletters and promotional offers (subject to your opt-in/opt-out preferences).</li>
              <li><strong>Legal Obligations:</strong> To comply with tax laws, immigration requirements, and anti-money laundering regulations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">5. Legal Basis for Processing (GDPR &amp; DPDP Act)</h2>
            <p className="mt-3">We rely on the following legal grounds:</p>
            <ol className="mt-3 list-decimal pl-6 space-y-2">
              <li><strong>Consent:</strong> Explicit permission granted by you for specific purposes (e.g., marketing).</li>
              <li><strong>Contractual Necessity:</strong> Processing required to perform the services you have purchased.</li>
              <li><strong>Legal Obligation:</strong> Processing required by law (e.g., reporting to the Bureau of Immigration in India).</li>
              <li><strong>Legitimate Interests:</strong> For business improvements and website security, provided these do not override your fundamental rights.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">6. Data Sharing &amp; Third Parties</h2>
            <p className="mt-3">Yono DMC shares data with selected third parties only to the extent necessary to facilitate your travel:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li><strong>Service Providers:</strong> Airlines, hotels, transport operators, and local tour guides.</li>
              <li><strong>Financial Facilitators:</strong> Secure payment gateways for transaction processing.</li>
              <li><strong>Corporate Tools:</strong> Cloud storage providers (AWS/Google Cloud) and CRM systems.</li>
              <li><strong>Legal Authorities:</strong> Government or regulatory bodies when mandated by law for national security or border control.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">7. International Data Transfers</h2>
            <p className="mt-3">As an OTA, your data may be transferred to and stored in countries outside your residence (for example, a hotel reservation in a foreign destination). We ensure such transfers are protected by:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>Standard Contractual Clauses (SCCs) for EU residents.</li>
              <li>Compliance with the cross-border transfer rules outlined in the India DPDP Act 2023.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">8. Data Retention</h2>
            <p className="mt-3">We retain personal data only for as long as necessary to fulfill the purposes for which it was collected, including for legal, accounting, or reporting requirements. Typically, booking records are retained for <strong>7 years</strong> to comply with Indian tax and corporate laws.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">9. Data Security</h2>
            <p className="mt-3">We implement robust technical and organizational measures, including <strong>SSL encryption</strong>, firewalls, and restricted access protocols, to protect your data against unauthorized access, loss, or alteration.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">10. Your Legal Rights</h2>
            <p className="mt-3">Under applicable laws, you possess the following rights:</p>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Right to Correction:</strong> Update inaccurate or incomplete information.</li>
              <li><strong>Right to Erasure:</strong> Request deletion of data (subject to legal retention requirements).</li>
              <li><strong>Right to Withdraw Consent:</strong> Revoke your consent for processing at any time.</li>
              <li><strong>Right to Portability:</strong> Request the transfer of your data to another service provider.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">11. Childrens Privacy</h2>
            <p className="mt-3">We do not knowingly collect data from individuals under the age of 18 without parental or guardian consent. If we discover we have inadvertently collected such data, it will be deleted immediately.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">12. Cookies Policy Summary</h2>
            <p className="mt-3">Our website uses cookies to enhance user experience and analyze traffic. You can manage your cookie preferences through your browser settings. For a detailed breakdown, please visit our separate Cookie Policy page.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">13. Updates to This Policy</h2>
            <p className="mt-3">We reserve the right to modify this Policy at any time. Significant changes will be notified via a prominent notice on our homepage or via email.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900">14. Contact Information</h2>
            <p className="mt-3">
              For grievances, data access requests, or privacy inquiries, please contact our Data Protection Officer:
            </p>
            <p className="mt-3">
              <strong>Yono DMC</strong>
              <br />
              <strong>Email:</strong> info@yonodmc.in
              <br />
              <strong>Registered Office:</strong> Unit No. 259, 2nd Floor, Tower No. B1, SPAZE ITECH PARK, Badshahpur Sohna Rd, Sector 49, Gurugram, Haryana 122018
              <br />
              <strong>Grievance Officer (DPDP Act Compliance):</strong> To be updated
            </p>
          </section>

          <section>
            <p className="text-sm text-slate-600">
              Effective Date: 22-07-2022
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
