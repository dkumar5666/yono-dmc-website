import type { Metadata } from "next";
import DestinationsClient from "./DestinationsClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Destinations | Yono DMC",
  description:
    "Browse top international and domestic destinations with curated Yono DMC holiday packages.",
  alternates: {
    canonical: "/destinations",
  },
  openGraph: {
    title: "Destinations | Yono DMC",
    description: "Explore destination guides and curated holiday options with Yono DMC.",
    url: "/destinations",
    type: "website",
  },
};

export default function DestinationsPage() {
  return <DestinationsClient />;
}
