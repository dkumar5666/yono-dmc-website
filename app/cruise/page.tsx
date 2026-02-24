import { Ship } from "lucide-react";
import ServiceInfoPage from "@/components/ServiceInfoPage";

export default function CruisePage() {
  return (
    <ServiceInfoPage
      title="Cruise"
      description="Discover sea and river cruise options with cabin categories, route guidance, and curated onboard experiences."
      bullets={[
        "Short leisure cruises and multi-night cruise vacations",
        "Cabin selection support based on budget and comfort",
        "Combined planning with flights, stays, and shore activities",
      ]}
      icon={<Ship className="h-6 w-6" />}
    />
  );
}
