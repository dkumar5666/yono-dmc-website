"use client";

import { useState } from "react";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = `Name: ${formData.name}%0AEmail: ${formData.email}%0APhone: ${formData.phone}%0ASubject: ${formData.subject}%0AMessage: ${formData.message}`;
    window.open(`https://wa.me/919876543210?text=${msg}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-blue-900 text-white py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
        <p className="text-xl text-gray-300">
          Get in touch with our travel experts
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg p-8 space-y-4"
        >
          <h2 className="text-2xl font-bold mb-4">Send Us a Message</h2>

          {["name", "email", "phone", "subject"].map((field) => (
            <input
              key={field}
              required
              placeholder={field.toUpperCase()}
              value={(formData as any)[field]}
              onChange={(e) =>
                setFormData({ ...formData, [field]: e.target.value })
              }
              className="w-full px-4 py-3 border rounded-lg"
            />
          ))}

          <textarea
            required
            rows={4}
            placeholder="Message"
            value={formData.message}
            onChange={(e) =>
              setFormData({ ...formData, message: e.target.value })
            }
            className="w-full px-4 py-3 border rounded-lg"
          />

          <button className="w-full bg-teal-500 text-white py-3 rounded-lg flex justify-center gap-2">
            <Send className="w-5 h-5" /> Send via WhatsApp
          </button>
        </form>

        <div className="space-y-6">
          {[
            { icon: <Phone />, text: "+91 98765 43210" },
            { icon: <Mail />, text: "info@yonodmc.in" },
            { icon: <MapPin />, text: "Mumbai, Maharashtra" },
            { icon: <Clock />, text: "Mon–Sat: 9 AM – 7 PM" },
          ].map((i, idx) => (
            <div key={idx} className="bg-white p-6 rounded-xl shadow flex gap-4">
              <div className="w-12 h-12 bg-teal-100 text-teal-600 flex items-center justify-center rounded-lg">
                {i.icon}
              </div>
              <p className="text-gray-700">{i.text}</p>
            </div>
          ))}
        </div>
      </section>

      <WhatsAppButton fixed />
    </div>
  );
}
