import { Holiday } from "@/data/holidays";

interface HolidayPackageDetailsProps {
  holiday: Holiday;
}

export default function HolidayPackageDetails({
  holiday,
}: HolidayPackageDetailsProps) {
  return (
    <section className="space-y-6">
      <article className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Hotel Details</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">City</th>
                <th className="py-2 pr-3">Nights</th>
                <th className="py-2 pr-3">Hotel</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Room</th>
                <th className="py-2">Meal Plan</th>
              </tr>
            </thead>
            <tbody>
              {holiday.hotels.map((hotel, idx) => (
                <tr key={`hotel-${idx}`} className="border-b last:border-b-0">
                  <td className="py-3 pr-3">{hotel.city}</td>
                  <td className="py-3 pr-3">{hotel.nights}</td>
                  <td className="py-3 pr-3">{hotel.hotelName}</td>
                  <td className="py-3 pr-3">{hotel.category}</td>
                  <td className="py-3 pr-3">{hotel.roomType}</td>
                  <td className="py-3">{hotel.mealPlan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-semibold mb-4">Package Highlights</h2>
        <ul className="grid md:grid-cols-2 gap-3 text-gray-700">
          {holiday.highlights.map((item, idx) => (
            <li key={`highlight-${idx}`} className="flex gap-2">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </article>

      <div className="grid md:grid-cols-2 gap-6">
        <article className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Inclusions</h2>
          <ul className="space-y-2 text-gray-700">
            {holiday.inclusions.map((item, idx) => (
              <li key={`inclusion-${idx}`} className="flex gap-2">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Exclusions</h2>
          <ul className="space-y-2 text-gray-700">
            {holiday.exclusions.map((item, idx) => (
              <li key={`exclusion-${idx}`} className="flex gap-2">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Important Notes</h2>
        <ul className="space-y-2 text-gray-700">
          {holiday.notes.map((item, idx) => (
            <li key={`note-${idx}`} className="flex gap-2">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
