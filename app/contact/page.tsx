"use client";

import { useState } from "react";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  type FormField = keyof typeof formData;
  const formFields: Array<{ key: FormField; label: string; type: string; minLength?: number }> = [
    { key: "name", label: "Name", type: "text", minLength: 2 },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone", type: "tel", minLength: 10 },
    { key: "subject", label: "Subject", type: "text", minLength: 2 },
  ];
  const whatsappNumber = "919958839319";
  const email = "info@yonodmc.in";
  const googleMapLink = "https://share.google/5epho29t1iMGwnbUz";
  const officeAddress =
    "Unit No. 259, 2nd Floor, Tower No. B1, SPAZE ITECH PARK, Badshahpur Sohna Rd, Sector 49, Gurugram, Haryana 122018";
  const mapEmbedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(officeAddress)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = `Name: ${formData.name}%0AEmail: ${formData.email}%0APhone: ${formData.phone}%0ASubject: ${formData.subject}%0AMessage: ${formData.message}`;
    window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-[#199ce0] text-white py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
        <p className="text-xl text-white/90">
          Get in touch with our travel experts
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg p-8 space-y-4"
        >
          <h2 className="text-2xl font-bold mb-4">Send Us a Message</h2>

          {formFields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                {field.label} <span className="text-red-500">*</span>
              </label>
              <input
                required
                minLength={field.minLength}
                type={field.type}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                value={formData[field.key]}
                onChange={(e) =>
                  setFormData({ ...formData, [field.key]: e.target.value })
                }
                className="w-full px-4 py-3 border rounded-lg"
              />
            </div>
          ))}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              minLength={10}
              rows={4}
              placeholder="Enter your message"
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              className="w-full px-4 py-3 border rounded-lg"
            />
          </div>

          <button className="w-full bg-[#f5991c] text-white py-3 rounded-lg flex justify-center gap-2 font-semibold hover:opacity-90">
            <Send className="w-5 h-5" /> Send via WhatsApp
          </button>
        </form>

        <div className="space-y-6">
          {[
            {
              icon: <Phone className="w-6 h-6" />,
              label: "Phone / WhatsApp",
              text: "+91 99588 39319",
              href: "tel:+919958839319",
            },
            {
              icon: <Mail className="w-6 h-6" />,
              label: "Email",
              text: email,
              href: `mailto:${email}`,
            },
            {
              icon: <MapPin className="w-6 h-6" />,
              label: "Business Address",
              text: officeAddress,
              href: googleMapLink,
            },
            {
              icon: <Clock className="w-6 h-6" />,
              label: "Working Hours",
              text: "Mon-Sat: 09 AM to 06 PM",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white p-6 rounded-xl shadow flex gap-4 items-start"
            >
              <div className="w-12 h-12 bg-orange-100 text-[#f5991c] flex items-center justify-center rounded-lg shrink-0">
                {item.icon}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                {item.href ? (
                  <a
                    href={item.href}
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                    className="text-gray-700 hover:text-[#199ce0] hover:underline"
                  >
                    {item.text}
                  </a>
                ) : (
                  <p className="text-gray-700">{item.text}</p>
                )}
              </div>
            </div>
          ))}

          <div className="bg-white p-4 rounded-xl shadow">
            <p className="text-sm font-semibold text-slate-900 mb-3">Location on Map</p>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <iframe
                title="Yono DMC Location"
                src={mapEmbedSrc}
                width="100%"
                height="260"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

