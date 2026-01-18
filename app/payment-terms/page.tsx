export default function PaymentTermsPage() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-6">Payment Terms</h1>

      <p className="text-gray-600 mb-4">
        All payments made to Yono DMC are subject to the following terms and
        conditions.
      </p>

      <ul className="list-disc pl-6 space-y-2 text-gray-600">
        <li>Prices are subject to availability at the time of booking.</li>
        <li>Full or partial payment may be required to confirm bookings.</li>
        <li>Cancellation charges may apply as per supplier policies.</li>
        <li>All disputes are subject to Gurugram jurisdiction.</li>
      </ul>
    </section>
  );
}