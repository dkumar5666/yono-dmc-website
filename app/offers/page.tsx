import type { Metadata } from "next";
import OffersClient from "./OffersClient";

export const metadata: Metadata = {
  title: "Offers",
  description:
    "Browse latest Yono DMC offers across flights, stays, packages, things to do, cabs, trains, bus, forex, cruise, insurance, and visa assistance.",
};

export default function OffersPage({
  searchParams,
}: {
  searchParams?: { category?: string };
}) {
  const initialCategory =
    typeof searchParams?.category === "string" ? searchParams.category : undefined;
  return <OffersClient initialCategory={initialCategory} />;
}
