import Link from "next/link";
import WhatsAppButton from "@/components/WhatsAppButton";
import {
  Award,
  Users,
  MapPin,
  Heart,
  Globe2,
  ShieldCheck,
  Clock3,
  ArrowRight,
} from "lucide-react";

const trustCards = [
  {
    icon: <Users className="h-6 w-6" />,
    title: "Customer-First Planning",
    desc: "Trip plans designed around your budget, style, and pace.",
  },
  {
    icon: <MapPin className="h-6 w-6" />,
    title: "Global Destination Network",
    desc: "High-demand countries and cities with reliable local partners.",
  },
  {
    icon: <Award className="h-6 w-6" />,
    title: "Execution You Can Trust",
    desc: "Fast response, clear costing, and grounded recommendations.",
  },
  {
    icon: <Heart className="h-6 w-6" />,
    title: "Human Support",
    desc: "A real team helping before departure and during travel.",
  },
];

const processSteps = [
  {
    title: "Share Your Requirement",
    desc: "Destination, dates, budget, and traveler profile.",
  },
  {
    title: "Get Curated Plan",
    desc: "Receive practical itinerary options with transparent costing.",
  },
  {
    title: "Confirm & Travel",
    desc: "We lock services, support docs, and stay available till return.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#199ce0] via-[#178fcc] to-[#0f6f9f] text-white">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#f5991c]/35 blur-2xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="inline-flex rounded-full border border-white/40 px-4 py-1 text-sm font-medium text-white/95 mb-5">
                About Yono DMC
              </p>
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                Travel Designed
                <br />
                Around You
              </h1>
              <p className="mt-5 text-lg md:text-xl text-white/90 max-w-2xl">
                We build international trips that balance experience, comfort,
                and value. Clear planning, honest pricing, and reliable support
                from first call to final return.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <WhatsAppButton
                  text="Talk to Our Expert"
                  className="bg-[#f5991c] text-white hover:opacity-90"
                />
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-full bg-[#f5991c] px-6 py-3 font-semibold text-white hover:opacity-90"
                >
                  Contact Team
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/15 backdrop-blur border border-white/20 p-5">
                <Globe2 className="h-6 w-6 mb-3" />
                <p className="text-2xl font-bold">International</p>
                <p className="text-white/85 text-sm">Curated holiday focus</p>
              </div>
              <div className="rounded-2xl bg-white/15 backdrop-blur border border-white/20 p-5">
                <ShieldCheck className="h-6 w-6 mb-3" />
                <p className="text-2xl font-bold">Transparent</p>
                <p className="text-white/85 text-sm">Clear inclusions and pricing</p>
              </div>
              <div className="rounded-2xl bg-white/15 backdrop-blur border border-white/20 p-5">
                <Clock3 className="h-6 w-6 mb-3" />
                <p className="text-2xl font-bold">Fast Support</p>
                <p className="text-white/85 text-sm">Quick turnaround on planning</p>
              </div>
              <div className="rounded-2xl bg-white/15 backdrop-blur border border-white/20 p-5">
                <MapPin className="h-6 w-6 mb-3" />
                <p className="text-2xl font-bold">Multi-Destination</p>
                <p className="text-white/85 text-sm">Country + city combinations</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-12 md:py-14">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-7 md:p-10">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Who We Are</h2>
          <div className="mt-5 grid md:grid-cols-2 gap-6 text-slate-700 text-lg">
            <p>
              Yono DMC is a destination management company focused on practical,
              high-quality international holidays for Indian travelers. We bring
              structured planning and clear communication to each itinerary.
            </p>
            <p>
              Our team works with trusted hotels, transfer providers, and
              activity partners to deliver smooth execution. From honeymoon to
              family and group tours, we tailor every trip to fit your goals.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {trustCards.map((item, i) => (
            <div
              key={i}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-[#199ce0] group-hover:bg-[#199ce0] group-hover:text-white transition-colors">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-12">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-7 md:p-10">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">How We Work</h2>
              <p className="text-slate-600 mt-2">Simple process, no confusion.</p>
            </div>
            <Link href="/holidays" className="hidden md:inline-flex items-center gap-2 font-semibold text-[#199ce0]">
              Browse Packages <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {processSteps.map((step, i) => (
              <div key={step.title} className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                <p className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#199ce0] text-white text-sm font-semibold mb-3">
                  {i + 1}
                </p>
                <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="text-slate-600 mt-2">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-14">
        <div className="bg-gradient-to-r from-[#199ce0] to-[#127db4] text-white rounded-3xl p-8 md:p-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-center">Ready to Plan Your Next Trip?</h2>
          <p className="text-lg text-white/90 mb-6 text-center max-w-3xl mx-auto">
            Connect with our travel team for customized itineraries, visa
            guidance, and end-to-end support.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <WhatsAppButton
              text="Talk to Our Expert"
              className="bg-[#f5991c] text-white hover:opacity-90"
            />
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full bg-[#f5991c] px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              Open Contact Page
            </Link>
          </div>
          <div className="mt-6 text-sm text-white/90 text-center space-y-1">
            <p>Phone: +91 99588 39319 | Email: info@yonodmc.in</p>
            <p>
              Unit No. 259, 2nd Floor, Tower No. B1, SPAZE ITECH PARK,
              Badshahpur Sohna Rd, Sector 49, Gurugram, Haryana 122018
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
