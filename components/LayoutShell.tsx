"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const CookieConsentBanner = dynamic(
  () => import("@/components/CookieConsentBanner"),
  { ssr: false }
);
const AIChatWidget = dynamic(() => import("@/components/AIChatWidget"), {
  ssr: false,
});

const HIDE_CHROME_PREFIXES = [
  "/login",
  "/signup",
  "/admin",
  "/supplier/login",
  "/agent/login",
  "/official-login",
  "/official/login",
];

function shouldHideChrome(pathname: string): boolean {
  return HIDE_CHROME_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname ? shouldHideChrome(pathname) : false;

  return (
    <>
      {!hideChrome && <Header />}
      <main>{children}</main>
      {!hideChrome && <Footer />}
      {!hideChrome && <CookieConsentBanner />}
      {!hideChrome && <AIChatWidget />}
    </>
  );
}
