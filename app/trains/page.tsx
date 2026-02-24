import { TrainFront } from "lucide-react";
import ServiceInfoPage from "@/components/ServiceInfoPage";

export default function TrainsPage() {
  return (
    <ServiceInfoPage
      title="Trains"
      description="Search and request intercity and scenic rail journeys with flexible classes and schedules."
      bullets={[
        "Intercity and regional train planning",
        "Seat class guidance and preferred departure windows",
        "Bundled with hotels, cabs, and activities",
      ]}
      icon={<TrainFront className="h-6 w-6" />}
    />
  );
}
