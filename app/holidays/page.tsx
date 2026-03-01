import type { Metadata } from "next";
import { Suspense } from "react";
import HolidaysClient from "./HolidaysClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Holidays",
  description:
    "Explore domestic and international holidays including Dubai, Bali, Singapore, and Malaysia with Yono DMC.",
  alternates: {
    canonical: "/holidays",
  },
  openGraph: {
    title: "Holiday Packages | Yono DMC",
    description:
      "Explore domestic and international holidays including Dubai, Bali, Singapore, and Malaysia with Yono DMC.",
    url: "/holidays",
    type: "website",
  },
};

export default function HolidaysPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <HolidaysClient />
    </Suspense>
  );
}
