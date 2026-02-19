CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY,
  destination_name TEXT NOT NULL,
  tagline VARCHAR(255) NOT NULL,
  continent TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '/api/images/hero',
  package_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS destination_cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_id TEXT NOT NULL,
  city_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(destination_id) REFERENCES destinations(id) ON DELETE CASCADE,
  UNIQUE(destination_id, city_name)
);

CREATE TABLE IF NOT EXISTS holiday_packages (
  id TEXT PRIMARY KEY,
  package_name TEXT NOT NULL,
  package_description TEXT NOT NULL,
  travel_date TEXT,
  travel_start_date TEXT,
  travel_end_date TEXT,
  itinerary_description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  flight_link TEXT,
  airline_name TEXT,
  departure_city TEXT,
  arrival_city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS package_passenger_details (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL UNIQUE,
  number_of_passengers INTEGER NOT NULL,
  number_of_rooms INTEGER NOT NULL,
  room_category TEXT NOT NULL,
  hotel_category TEXT NOT NULL,
  hotel_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(package_id) REFERENCES holiday_packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS package_hotels (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  hotel_name TEXT NOT NULL,
  hotel_category TEXT NOT NULL,
  room_category TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(package_id) REFERENCES holiday_packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS package_itinerary (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(package_id) REFERENCES holiday_packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS package_addons (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  addon_key TEXT NOT NULL,
  addon_label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  FOREIGN KEY(package_id) REFERENCES holiday_packages(id) ON DELETE CASCADE,
  UNIQUE(package_id, addon_key)
);

CREATE INDEX IF NOT EXISTS idx_destination_cities_destination_id
  ON destination_cities(destination_id);

CREATE INDEX IF NOT EXISTS idx_package_itinerary_package_id
  ON package_itinerary(package_id);

CREATE INDEX IF NOT EXISTS idx_package_addons_package_id
  ON package_addons(package_id);

CREATE INDEX IF NOT EXISTS idx_package_hotels_package_id
  ON package_hotels(package_id);
