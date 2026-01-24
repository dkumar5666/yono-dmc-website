import WhatsAppButton from "@/components/WhatsAppButton";
import { Award, Users, MapPin, Heart } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            About YONO DMC
          </h1>
          <p className="text-xl text-gray-300">
            Your trusted partner for international travel
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <h2 className="text-3xl font-bold mb-6">Who We Are</h2>
          <div className="space-y-4 text-gray-700 text-lg">
            <p>
              YONO DMC is a leading Destination Management Company specializing
              in unforgettable international holidays for Indian travelers.
            </p>
            <p>
              We work directly with hotels, airlines, and local partners to
              deliver transparent pricing and superior service.
            </p>
            <p>
              From honeymoons to family vacations, we design experiences that
              match your dreams and budget.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {[
            { icon: <Users />, title: "1000+ Happy Travelers", desc: "Worldwide" },
            { icon: <MapPin />, title: "50+ Destinations", desc: "Global reach" },
            { icon: <Award />, title: "10+ Years Experience", desc: "Industry expertise" },
            { icon: <Heart />, title: "100% Satisfaction", desc: "Customer-first" },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl shadow-md p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-teal-100 text-teal-600 rounded-full">
                {item.icon}
              </div>
              <h3 className="font-bold mb-2">{item.title}</h3>
              <p className="text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-2xl p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Start Your Journey?
          </h2>
          <p className="text-xl mb-6">
            Let’s plan your perfect international holiday
          </p>
          <WhatsAppButton
            text="Talk to Our Expert"
            className="bg-white text-teal-600 hover:bg-gray-100"
          />
        </div>
      </section>

      <WhatsAppButton fixed />
    </div>
  );
}
