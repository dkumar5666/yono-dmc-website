import type { Metadata } from "next";
import Link from "next/link";
import LeadCaptureForm from "@/components/public/LeadCaptureForm";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Plan My Trip | Yono DMC",
  description:
    "Tell us your destination, travel dates, and budget. Yono DMC travel experts will share the best trip options for your plan.",
  alternates: {
    canonical: "/plan-my-trip",
  },
  openGraph: {
    title: "Plan My Trip | Yono DMC",
    description:
      "Share your destination, dates, and budget to receive a curated travel plan from Yono DMC experts.",
    url: "/plan-my-trip",
    type: "website",
  },
};

export default function PlanMyTripPage() {
  const supportWhatsAppUrl =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_URL?.trim() || "https://wa.me/919958839319";
  return (
    <main className="bg-gradient-to-b from-slate-100 via-white to-slate-50 py-10 md:py-14">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-6">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">Plan Your Next Trip</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
            Share your preferences once and our team will help you build the right itinerary, hotels, transport, and
            activities.
          </p>
        </div>
        <LeadCaptureForm />
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">Need immediate help?</h2>
              <p className="text-sm text-slate-600">
                Connect with Yono DMC support for quick guidance before submitting your request.
              </p>
            </div>
            <a
              href={supportWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#148bc7]"
            >
              Support WhatsApp
            </a>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <Link href="/support" className="font-medium text-[#199ce0] hover:underline">
              FAQ & Support
            </Link>
            <Link href="/travel-tips-guides" className="font-medium text-[#199ce0] hover:underline">
              Travel Tips & Guides
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
