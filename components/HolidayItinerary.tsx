import { ItineraryDay } from "@/data/holidays";

interface HolidayItineraryProps {
  itinerary: ItineraryDay[];
}

export default function HolidayItinerary({ itinerary }: HolidayItineraryProps) {
  if (itinerary.length === 0) {
    return (
      <section className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-semibold mb-3">Day Wise Itinerary</h2>
        <p className="text-gray-600">
          Detailed itinerary will be shared based on your travel dates.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm">
      <h2 className="text-2xl font-semibold mb-6">Day Wise Itinerary</h2>
      <div className="space-y-5">
        {itinerary.map((item) => (
          <article key={`day-${item.day}`} className="border rounded-xl p-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="w-9 h-9 rounded-full bg-teal-600 text-white text-sm inline-flex items-center justify-center shrink-0 font-semibold">
                D{item.day}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-600">Overnight: {item.overnight}</p>
                {item.meals ? (
                  <p className="text-sm text-gray-600">Meals: {item.meals}</p>
                ) : null}
              </div>
            </div>
            <ul className="space-y-2 text-gray-700 pl-1">
              {item.details.map((detail, idx) => (
                <li key={`day-${item.day}-detail-${idx}`} className="flex gap-2">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
