import type { Metadata } from "next";
import { ReactNode } from "react";
import Script from "next/script";
import { Poppins } from "next/font/google";
import LayoutShell from "@/components/LayoutShell";
import "./globals.css";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

const siteUrlValue = process.env.SITE_URL?.trim() || "https://www.yonodmc.in";
const metadataBase = (() => {
  try {
    return new URL(siteUrlValue);
  } catch {
    return new URL("https://www.yonodmc.in");
  }
})();

const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim() || "";
const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim() || "";

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Yono DMC - Trusted Travel Agency in India",
    template: "%s | Yono DMC",
  },
  description:
    "Yono DMC is a trusted travel agency in India offering customized domestic and international holidays including Dubai, Bali, Singapore, Malaysia, and more.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Yono DMC",
    title: "Yono DMC - Trusted Travel Agency in India",
    description:
      "Plan holidays, flights, stays, and curated experiences with Yono DMC.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yono DMC - Trusted Travel Agency in India",
    description:
      "Plan holidays, flights, stays, and curated experiences with Yono DMC.",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans antialiased`}>
        {gtmId ? (
          <Script id="gtm-init" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `}</Script>
        ) : gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}</Script>
          </>
        ) : null}
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
