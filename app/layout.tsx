import type { Metadata } from "next";
import { ReactNode } from "react";
import { Poppins } from "next/font/google";
import LayoutShell from "@/components/LayoutShell";
import "./globals.css";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: {
    default: "Yono DMC - Trusted Travel Agency in India",
    template: "%s | Yono DMC",
  },
  description:
    "Yono DMC is a trusted travel agency in India offering customized domestic & international holiday packages including Dubai, Bali, Singapore, Malaysia and more.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans antialiased`}>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
