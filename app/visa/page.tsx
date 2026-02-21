import WhatsAppButton from "@/components/WhatsAppButton";
import { FileText, Check, Clock } from "lucide-react";

const visaServices = [
  {
    country: "Dubai (UAE)",
    types: ["Tourist Visa", "Transit Visa"],
    processing: "3–5 working days",
    validity: "30 days",
    requirements: [
      "Passport copy",
      "Photo",
      "Hotel booking",
      "Flight ticket",
    ],
  },
  {
    country: "Singapore",
    types: ["Tourist Visa", "Business Visa"],
    processing: "4–6 working days",
    validity: "30 days",
    requirements: ["Passport copy", "Photos", "Bank statement", "ITR"],
  },
  {
    country: "Malaysia",
    types: ["Tourist Visa", "eVisa"],
    processing: "3–4 working days",
    validity: "90 days",
    requirements: [
      "Passport copy",
      "Photo",
      "Hotel booking",
      "Return ticket",
    ],
  },
  {
    country: "Bali (Indonesia)",
    types: ["Visa on Arrival", "Tourist Visa"],
    processing: "On arrival / 5–7 days",
    validity: "30 days",
    requirements: [
      "Valid passport",
      "Return ticket",
      "Sufficient funds",
    ],
  },
];

export default function VisaPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Visa Services
          </h1>
          <p className="text-xl text-gray-300">
            Hassle-free visa assistance for all destinations
          </p>
        </div>
      </section>

      {/* Visa Cards */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {visaServices.map((visa, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h3 className="text-2xl font-bold mb-4">
                {visa.country}
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm font-medium mb-2">
                    Visa Types:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {visa.types.map((type, i) => (
                      <span
                        key={i}
                        className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-teal-600" />
                  <span>
                    <strong>Processing:</strong>{" "}
                    {visa.processing}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-teal-600" />
                  <span>
                    <strong>Validity:</strong>{" "}
                    {visa.validity}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">
                    Basic Requirements:
                  </p>
                  <ul className="space-y-1">
                    {visa.requirements.map((req, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <WhatsAppButton
                text="Apply via WhatsApp"
                className="w-full justify-center"
              />
            </div>
          ))}
        </div>

        {/* Process */}
        <div className="bg-blue-50 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">
            How Visa Process Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: "1",
                title: "Submit Documents",
                desc: "Send documents via WhatsApp",
              },
              {
                step: "2",
                title: "Verification",
                desc: "We verify your application",
              },
              {
                step: "3",
                title: "Application",
                desc: "Submitted to consulate",
              },
              {
                step: "4",
                title: "Visa Approved",
                desc: "You’re ready to travel",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-1">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
