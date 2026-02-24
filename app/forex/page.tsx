import { Banknote } from "lucide-react";
import ServiceInfoPage from "@/components/ServiceInfoPage";

export default function ForexPage() {
  return (
    <ServiceInfoPage
      title="Forex"
      description="Get destination-wise currency guidance and pre-travel forex support for smooth international travel."
      bullets={[
        "Currency planning by destination and trip duration",
        "Forex card and cash mix recommendations",
        "Aligned with your booking and payment schedule",
      ]}
      icon={<Banknote className="h-6 w-6" />}
    />
  );
}
