interface HolidayItineraryProps {
  itinerary?: string[];
}

export default function HolidayItinerary({ itinerary = [] }: HolidayItineraryProps) {
  if (itinerary.length === 0) {
    return (
      <section className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">Itinerary</h2>
        <p className="text-gray-600">Detailed itinerary will be shared based on your travel dates.</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm">
      <h2 className="text-2xl font-semibold mb-6">Itinerary</h2>
      <ol className="space-y-4">
        {itinerary.map((item, idx) => (
          <li key={`${idx}-${item}`} className="flex gap-3">
            <span className="w-7 h-7 rounded-full bg-teal-600 text-white text-sm inline-flex items-center justify-center shrink-0">
              {idx + 1}
            </span>
            <p className="text-gray-700">{item}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
