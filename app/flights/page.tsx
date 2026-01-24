import WhatsAppButton from "@/components/WhatsAppButton";
import { Plane, Info } from "lucide-react";

export default function FlightsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-blue-900 text-white py-16 text-center">
        <Plane className="w-16 h-16 mx-auto mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Flight Bookings
        </h1>
        <p className="text-xl text-gray-300">
          Best prices for international flights
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Search Flights</h2>

          <div className="bg-blue-50 p-4 rounded-lg flex gap-3 mb-6">
            <Info className="w-5 h-5 text-blue-600" />
            <p className="text-sm">
              Get exclusive DMC flight rates via WhatsApp confirmation.
            </p>
          </div>

          <WhatsAppButton text="Check Flight Availability" className="w-full justify-center" />
        </div>
      </section>

      <WhatsAppButton fixed />
    </div>
  );
}
