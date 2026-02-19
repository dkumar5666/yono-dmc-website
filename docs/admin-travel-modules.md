# Admin Destinations + Holiday Builder

## Migration
- SQL migration file: `db/migrations/001_travel_core.sql`
- SQLite DB file at runtime: `.runtime/travel.sqlite`
- Migration runner: `lib/backend/sqlite.ts`

## REST API

### Destination Management
- `GET /api/admin/destinations`
- `POST /api/admin/destinations`
- `PUT /api/admin/destinations/:id`
- `DELETE /api/admin/destinations/:id`

### Holiday Package Builder
- `GET /api/admin/holiday-packages`
- `POST /api/admin/holiday-packages`
- `GET /api/admin/holiday-packages/:id`
- `PUT /api/admin/holiday-packages/:id`
- `DELETE /api/admin/holiday-packages/:id`
- `POST /api/admin/holiday-packages/:id/duplicate`

All routes require admin/editor authentication via existing session auth.

## Example Request Payload

```json
{
  "package_name": "Malaysia Family Escape",
  "package_description": "Family-focused package covering key Malaysian cities.",
  "travel_start_date": "2026-06-01",
  "travel_end_date": "2026-06-06",
  "itinerary_description": "<p>Comfort holiday with guided tours</p>",
  "status": "draft",
  "flight_link": "https://example.com/flight/offer-1",
  "airline_name": "Malaysia Airlines",
  "departure_city": "Delhi",
  "arrival_city": "Kuala Lumpur",
  "itinerary": [
    {
      "day_number": 1,
      "title": "Arrival in Kuala Lumpur",
      "description": "<p>Airport pickup and check-in.</p>"
    },
    {
      "day_number": 2,
      "title": "City Tour",
      "description": "<p>KL city highlights and shopping.</p>"
    }
  ],
  "passenger_details": {
    "number_of_passengers": 4,
    "number_of_rooms": 2,
    "room_category": "Deluxe",
    "hotel_category": "4 Star",
    "hotel_name": "Ibis KLCC"
  },
  "hotels": [
    {
      "hotel_name": "Ibis KLCC",
      "hotel_category": "4 Star",
      "room_category": "Deluxe",
      "city": "Kuala Lumpur",
      "notes": "Near city center"
    }
  ],
  "addons": [
    {
      "addon_key": "visa_assistance",
      "addon_label": "Visa Assistance",
      "enabled": true,
      "price": 2500
    },
    {
      "addon_key": "travel_insurance",
      "addon_label": "Travel Insurance",
      "enabled": true,
      "price": 1200
    }
  ]
}
```

## Example Response Payload

```json
{
  "data": {
    "id": "0c7cf9a1-a1fe-45e3-a532-4d7a291ef8de",
    "package_name": "Malaysia Family Escape",
    "status": "draft",
    "travel_date": null,
    "travel_start_date": "2026-06-01",
    "travel_end_date": "2026-06-06",
    "itinerary": [
      {
        "day_number": 1,
        "title": "Arrival in Kuala Lumpur",
        "description": "<p>Airport pickup and check-in.</p>"
      }
    ],
    "addons": [
      {
        "addon_key": "visa_assistance",
        "addon_label": "Visa Assistance",
        "enabled": true,
        "price": 2500
      }
    ],
    "hotels": [
      {
        "hotel_name": "Ibis KLCC",
        "hotel_category": "4 Star",
        "room_category": "Deluxe",
        "city": "Kuala Lumpur",
        "notes": "Near city center"
      }
    ],
    "passenger_details": {
      "number_of_passengers": 4,
      "number_of_rooms": 2,
      "room_category": "Deluxe",
      "hotel_category": "4 Star",
      "hotel_name": "Ibis KLCC"
    }
  }
}
```

## ER Diagram (Text)

```text
destinations
  PK id
  destination_name
  tagline
  continent
  image_url
  package_count
  created_at
  updated_at

destination_cities
  PK id
  FK destination_id -> destinations.id
  city_name
  sort_order

holiday_packages
  PK id
  package_name
  package_description
  travel_date
  travel_start_date
  travel_end_date
  itinerary_description
  status (draft|published|archived)
  flight_link
  airline_name
  departure_city
  arrival_city
  created_at
  updated_at

package_passenger_details
  PK id
  FK package_id -> holiday_packages.id (UNIQUE)
  number_of_passengers
  number_of_rooms
  room_category
  hotel_category
  hotel_name
  created_at
  updated_at

package_hotels
  PK id
  FK package_id -> holiday_packages.id
  hotel_name
  hotel_category
  room_category
  city
  notes
  sort_order

package_itinerary
  PK id
  FK package_id -> holiday_packages.id
  day_number
  title
  description
  sort_order

package_addons
  PK id
  FK package_id -> holiday_packages.id
  addon_key
  addon_label
  enabled
  price
```
