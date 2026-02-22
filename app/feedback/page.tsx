"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CircleAlert, Star } from "lucide-react";

type FeedbackTopic = "compliment" | "suggestion" | "technical_issue" | "complaint";

export default function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [nps, setNps] = useState<number | null>(null);
  const [topic, setTopic] = useState<FeedbackTopic>("compliment");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  const showCompactForm = topic === "technical_issue";

  return (
    <section className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-bold text-slate-900">Share your feedback</h1>

        <div className="mt-6 rounded-2xl border border-slate-300 bg-white p-5">
          <div className="flex gap-3">
            <CircleAlert className="h-5 w-5 mt-0.5 text-slate-700 shrink-0" />
            <div className="text-slate-700 leading-relaxed">
              <p>
                We&apos;re unable to respond to any help requests made on this form. Please go to our{" "}
                <span className="font-semibold">customer support page</span> for further assistance.
              </p>
              <Link href="/support" className="mt-3 inline-block text-[#199ce0] hover:underline">
                Customer support page
              </Link>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
            <h2 className="text-2xl font-semibold">Thank you for your feedback</h2>
            <p className="mt-2">Your response has been recorded successfully.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-6">
            {!showCompactForm ? (
              <>
                <p className="text-sm text-slate-500">Fields marked with * are mandatory.</p>

                <div>
                  <p className="text-xl font-semibold text-slate-900">
                    Overall satisfaction with page <span className="text-red-500">*</span>
                  </p>
                  <div className="mt-3 flex items-center gap-5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        aria-label={`Rate ${value}`}
                        className="inline-flex flex-col items-center text-slate-700"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            value <= rating ? "fill-[#f5991c] text-[#f5991c]" : "text-slate-500"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center justify-between max-w-[280px] text-sm text-slate-500">
                    <span>Terrible</span>
                    <span>Excellent</span>
                  </div>
                </div>

                <div>
                  <p className="text-xl font-semibold text-slate-900">
                    How likely are you to recommend Yono DMC to a friend or colleague?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Array.from({ length: 11 }, (_, i) => i).map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setNps(score)}
                        className={`h-10 w-10 rounded-md border text-sm ${
                          nps === score
                            ? "bg-[#199ce0] border-[#199ce0] text-white"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
                    <span>Not likely at all</span>
                    <span>Extremely likely</span>
                  </div>
                </div>

                <div>
                  <p className="text-xl font-semibold text-slate-900">
                    Choose a comment topic <span className="text-red-500">*</span>
                  </p>
                  <div className="mt-2 space-y-2">
                    {[
                      { value: "compliment", label: "Compliment" },
                      { value: "suggestion", label: "Suggestion" },
                      { value: "technical_issue", label: "Technical Issue" },
                      { value: "complaint", label: "Complaint" },
                    ].map((item) => (
                      <label key={item.value} className="flex items-center gap-2 text-slate-700">
                        <input
                          type="radio"
                          name="topic"
                          value={item.value}
                          checked={topic === item.value}
                          onChange={() => setTopic(item.value as FeedbackTopic)}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-700">Thank you in advance for your feedback.</p>
                <p className="text-slate-700">
                  We&apos;re unable to respond to support queries raised via this form.
                </p>
              </>
            )}

            <label className="block">
              <span className="text-xl font-semibold text-slate-900">
                {showCompactForm
                  ? "Additional feedback"
                  : "Please include anything else you'd like us to know"}{" "}
                <span className="text-red-500">*</span>
              </span>
              <textarea
                required
                minLength={20}
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your comments here"
                className="mt-2 w-full rounded-xl border border-slate-400 bg-white px-4 py-3"
              />
            </label>

            <label className="block">
              <span className="text-xl font-semibold text-slate-900">Email address</span>
              <p className="mt-1 text-slate-500">
                We will use your email address to follow-up on account issues, and for no other
                purpose.
              </p>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="mt-2 w-full rounded-xl border border-slate-400 bg-white px-4 py-3"
              />
            </label>

            <div className="pt-1">
              <button
                type="submit"
                className="mx-auto block rounded-full bg-[#1b64e0] px-8 py-3 text-white font-semibold hover:opacity-90"
              >
                {showCompactForm ? "Submit" : "Send feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
