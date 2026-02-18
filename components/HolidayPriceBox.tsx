import WhatsAppButton from "@/components/WhatsAppButton";

interface Holiday {
  title: string;
  description: string;
  priceFrom?: string;
}

interface HolidayPriceBoxProps {
  holiday: Holiday;
}

export default function HolidayPriceBox({ holiday }: HolidayPriceBoxProps) {
  return (
    <aside className="bg-white rounded-2xl p-6 shadow-sm h-fit">
      <h3 className="text-xl font-semibold mb-4">Price & Enquiry</h3>
      <p className="text-sm text-gray-600 mb-2">Starting from</p>
      <p className="text-3xl font-bold text-teal-700 mb-4">{holiday.priceFrom ?? "Best Price"}</p>
      <p className="text-gray-600 mb-6">{holiday.description}</p>
      <WhatsAppButton text="Get Best Quote" className="w-full justify-center" />
    </aside>
  );
}
