import { ShieldCheck } from "lucide-react";
import ServiceInfoPage from "@/components/ServiceInfoPage";

export default function InsurancePage() {
  return (
    <ServiceInfoPage
      title="Insurance"
      description="Protect your trip with travel insurance options covering medical, delay, cancellation, and baggage scenarios."
      bullets={[
        "Destination and age-based policy recommendations",
        "Coverage support for cancellations, delays, and medical events",
        "Issued policy documents aligned with your itinerary",
      ]}
      icon={<ShieldCheck className="h-6 w-6" />}
    />
  );
}
