"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ConsentChoice = "all" | "essential";

type StoredConsent = {
  choice: ConsentChoice;
  timestamp: string;
  version: string;
};

const CONSENT_KEY = "yono_cookie_consent";
const CONSENT_VERSION = "2026-02-22";

function readConsent(): StoredConsent | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (!parsed?.choice || !parsed?.version) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveConsent(choice: ConsentChoice) {
  const payload: StoredConsent = {
    choice,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export default function CookieConsentBanner() {
  const [savedChoice, setSavedChoice] = useState<ConsentChoice | null>(() => {
    if (typeof window === "undefined") return null;
    const existing = readConsent();
    if (!existing || existing.version !== CONSENT_VERSION) return null;
    return existing.choice;
  });
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const existing = readConsent();
    return !existing || existing.version !== CONSENT_VERSION;
  });

  const choiceLabel = useMemo(() => {
    if (savedChoice === "all") return "All cookies enabled";
    if (savedChoice === "essential") return "Only essential cookies enabled";
    return "Cookie settings";
  }, [savedChoice]);

  function applyChoice(choice: ConsentChoice) {
    saveConsent(choice);
    setSavedChoice(choice);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-[70] rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow hover:bg-slate-50"
        aria-label="Open cookie settings"
      >
        {choiceLabel}
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-slate-200 bg-white/98 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-base font-semibold text-slate-900">Cookie Consent</p>
            <p className="mt-1 text-sm text-slate-600">
              We use essential cookies for core website functionality and, with your
              permission, additional cookies for analytics, personalization, and
              marketing. Review details in our{" "}
              <Link href="/cookie-policy" className="text-[#199ce0] underline">
                Cookie Policy
              </Link>{" "}
              and{" "}
              <Link href="/privacy-policy" className="text-[#199ce0] underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <button
              type="button"
              onClick={() => applyChoice("essential")}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reject Non-Essential
            </button>
            <button
              type="button"
              onClick={() => applyChoice("all")}
              className="rounded-full bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Accept All Cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
