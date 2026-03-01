import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Packages | Yono DMC",
  description:
    "Discover Yono DMC holiday packages for international and domestic destinations.",
  alternates: {
    canonical: "/holidays",
  },
};

export default function PackagesPage() {
  redirect("/holidays");
}


