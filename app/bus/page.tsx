import { Bus } from "lucide-react";
import ServiceInfoPage from "@/components/ServiceInfoPage";

export default function BusPage() {
  return (
    <ServiceInfoPage
      title="Bus"
      description="Book city-to-city and regional bus routes with comfort options and reliable boarding support."
      bullets={[
        "Sleeper, seater, and premium coach options",
        "Pickup and drop coordination for your itinerary",
        "Integrated planning with holidays and cabs",
      ]}
      icon={<Bus className="h-6 w-6" />}
    />
  );
}
