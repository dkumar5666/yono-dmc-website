import crypto from "node:crypto";
import { getDb } from "@/lib/backend/sqlite";

const allowedStatuses = ["draft", "published", "archived"] as const;
const allowedContinents = [
  "Asia",
  "Europe",
  "Africa",
  "North America",
  "South America",
  "Australia",
  "Antarctica",
] as const;

export type PackageStatus = (typeof allowedStatuses)[number];

export interface DestinationInput {
  destination_name: string;
  tagline: string;
  continent: string;
  cities?: string[];
  image_url?: string;
  package_count?: number;
}

export interface PackageItineraryInput {
  day_number: number;
  title: string;
  description: string;
}

export interface PackageAddonInput {
  addon_key: string;
  addon_label: string;
  enabled: boolean;
  price: number;
}

export interface PackageHotelInput {
  hotel_name: string;
  hotel_category: string;
  room_category: string;
  city?: string;
  notes?: string;
}

export interface PackagePassengerInput {
  number_of_passengers: number;
  number_of_rooms: number;
  room_category: string;
  hotel_category: string;
  hotel_name: string;
}

export interface HolidayPackageInput {
  package_name: string;
  package_description: string;
  travel_date?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  itinerary_description?: string;
  status?: PackageStatus;
  flight_link?: string | null;
  airline_name?: string | null;
  departure_city?: string | null;
  arrival_city?: string | null;
  itinerary: PackageItineraryInput[];
  addons: PackageAddonInput[];
  hotels: PackageHotelInput[];
  passenger_details: PackagePassengerInput;
}

interface SqlDestinationRow {
  id: string;
  destination_name: string;
  tagline: string;
  continent: string;
  image_url: string;
  package_count: number;
  created_at: string;
  updated_at: string;
}

interface SqlPackageRow {
  id: string;
  package_name: string;
  package_description: string;
  travel_date: string | null;
  travel_start_date: string | null;
  travel_end_date: string | null;
  itinerary_description: string;
  status: PackageStatus;
  flight_link: string | null;
  airline_name: string | null;
  departure_city: string | null;
  arrival_city: string | null;
  created_at: string;
  updated_at: string;
}

function sanitizeText(value: unknown, maxLen = 255): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function sanitizeLongText(value: unknown, maxLen = 10000): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

function toImageKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function ensureValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function mapDestinationRow(row: SqlDestinationRow, cities: string[]) {
  return {
    id: row.id,
    destination_name: row.destination_name,
    tagline: row.tagline,
    continent: row.continent,
    cities,
    image_url: row.image_url,
    package_count: row.package_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function fetchDestinationCities(destinationId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT city_name
       FROM destination_cities
       WHERE destination_id = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .all(destinationId) as Array<{ city_name: string }>;
  return rows.map((row) => row.city_name);
}

function validateDestinationInput(input: DestinationInput): string | null {
  if (!sanitizeText(input.destination_name)) {
    return "destination_name is required";
  }
  const tagline = sanitizeText(input.tagline, 255);
  if (!tagline) return "tagline is required";

  const continent = sanitizeText(input.continent, 50);
  if (!continent) return "continent is required";

  if (!allowedContinents.includes(continent as (typeof allowedContinents)[number])) {
    return `continent must be one of: ${allowedContinents.join(", ")}`;
  }

  if (Array.isArray(input.cities) && input.cities.some((city) => !sanitizeText(city, 120))) {
    return "cities must include valid non-empty values";
  }

  return null;
}

function normalizeDestinationInput(input: DestinationInput) {
  const destinationName = sanitizeText(input.destination_name, 120);
  const rawImage = sanitizeText(input.image_url ?? "", 500);
  const imageKey = toImageKey(destinationName || "hero");
  const imageUrl = rawImage
    ? rawImage
        .replace(/\\/g, "/")
        .replace(/^api\/images\//, "/api/images/")
        .replace(/^\/?api\/images\/([a-z0-9-]+)\.(png|jpg|jpeg|webp)$/i, "/api/images/$1")
    : `/api/images/${imageKey || "hero"}`;

  return {
    destination_name: destinationName,
    tagline: sanitizeText(input.tagline, 255),
    continent: sanitizeText(input.continent, 50),
    cities:
      Array.isArray(input.cities) && input.cities.length > 0
        ? input.cities.map((city) => sanitizeText(city, 120)).filter(Boolean)
        : [],
    image_url: imageUrl || "/api/images/hero",
    package_count:
      Number.isFinite(Number(input.package_count)) && Number(input.package_count) >= 0
        ? Number(input.package_count)
        : 0,
  };
}

export function listDestinations() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, destination_name, tagline, continent, image_url, package_count, created_at, updated_at
       FROM destinations
       ORDER BY destination_name ASC`
    )
    .all() as SqlDestinationRow[];

  return rows.map((row) => mapDestinationRow(row, fetchDestinationCities(row.id)));
}

export function createDestination(input: DestinationInput) {
  const validationError = validateDestinationInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const normalized = normalizeDestinationInput(input);
  const db = getDb();
  const id = crypto.randomUUID();

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO destinations (
         id, destination_name, tagline, continent, image_url, package_count
       ) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      normalized.destination_name,
      normalized.tagline,
      normalized.continent,
      normalized.image_url,
      normalized.package_count
    );

    const insertCity = db.prepare(
      `INSERT INTO destination_cities (destination_id, city_name, sort_order)
       VALUES (?, ?, ?)`
    );

    normalized.cities.forEach((city, index) => {
      insertCity.run(id, city, index);
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const created = db
    .prepare(
      `SELECT id, destination_name, tagline, continent, image_url, package_count, created_at, updated_at
       FROM destinations WHERE id = ?`
    )
    .get(id) as SqlDestinationRow;
  return mapDestinationRow(created, fetchDestinationCities(id));
}

export function updateDestination(id: string, input: DestinationInput) {
  const validationError = validateDestinationInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const normalized = normalizeDestinationInput(input);
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM destinations WHERE id = ?")
    .get(id) as { id: string } | undefined;
  if (!existing) {
    throw new Error("Destination not found");
  }

  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE destinations
       SET destination_name = ?,
           tagline = ?,
           continent = ?,
           image_url = ?,
           package_count = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      normalized.destination_name,
      normalized.tagline,
      normalized.continent,
      normalized.image_url,
      normalized.package_count,
      id
    );

    db.prepare("DELETE FROM destination_cities WHERE destination_id = ?").run(id);
    const insertCity = db.prepare(
      `INSERT INTO destination_cities (destination_id, city_name, sort_order)
       VALUES (?, ?, ?)`
    );
    normalized.cities.forEach((city, index) => {
      insertCity.run(id, city, index);
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const updated = db
    .prepare(
      `SELECT id, destination_name, tagline, continent, image_url, package_count, created_at, updated_at
       FROM destinations WHERE id = ?`
    )
    .get(id) as SqlDestinationRow;
  return mapDestinationRow(updated, fetchDestinationCities(id));
}

export function deleteDestination(id: string): void {
  const db = getDb();
  const result = db.prepare("DELETE FROM destinations WHERE id = ?").run(id);
  if (!result.changes) {
    throw new Error("Destination not found");
  }
}

function validatePackageInput(input: HolidayPackageInput): string | null {
  if (!sanitizeText(input.package_name, 160)) return "package_name is required";
  if (!sanitizeLongText(input.package_description, 5000)) {
    return "package_description is required";
  }

  const travelDate = sanitizeText(input.travel_date ?? "", 20);
  const startDate = sanitizeText(input.travel_start_date ?? "", 20);
  const endDate = sanitizeText(input.travel_end_date ?? "", 20);
  if (!travelDate && !(startDate && endDate)) {
    return "Either travel_date or travel_start_date + travel_end_date is required";
  }
  if (travelDate && !isIsoDate(travelDate)) {
    return "travel_date must use YYYY-MM-DD";
  }
  if (startDate && !isIsoDate(startDate)) {
    return "travel_start_date must use YYYY-MM-DD";
  }
  if (endDate && !isIsoDate(endDate)) {
    return "travel_end_date must use YYYY-MM-DD";
  }

  const status = input.status ?? "draft";
  if (!allowedStatuses.includes(status)) {
    return `status must be one of: ${allowedStatuses.join(", ")}`;
  }

  if (!Array.isArray(input.itinerary) || input.itinerary.length === 0) {
    return "At least one itinerary day is required";
  }
  if (input.itinerary.some((item) => !sanitizeText(item.title, 200))) {
    return "Each itinerary day requires a title";
  }
  if (input.itinerary.some((item) => !sanitizeLongText(item.description, 10000))) {
    return "Each itinerary day requires description";
  }

  if (!input.passenger_details) return "passenger_details is required";
  if (Number(input.passenger_details.number_of_passengers) < 1) {
    return "number_of_passengers must be at least 1";
  }
  if (Number(input.passenger_details.number_of_rooms) < 1) {
    return "number_of_rooms must be at least 1";
  }
  if (!sanitizeText(input.passenger_details.room_category, 80)) {
    return "room_category is required";
  }
  if (!sanitizeText(input.passenger_details.hotel_category, 80)) {
    return "hotel_category is required";
  }
  if (!sanitizeText(input.passenger_details.hotel_name, 120)) {
    return "hotel_name is required";
  }

  if (input.flight_link && !ensureValidUrl(input.flight_link)) {
    return "flight_link must be a valid URL";
  }

  if (!Array.isArray(input.addons)) return "addons must be an array";
  if (input.addons.some((addon) => !sanitizeText(addon.addon_key, 80))) {
    return "Each addon requires addon_key";
  }
  if (input.addons.some((addon) => !sanitizeText(addon.addon_label, 120))) {
    return "Each addon requires addon_label";
  }
  if (input.addons.some((addon) => Number(addon.price) < 0)) {
    return "Addon price cannot be negative";
  }

  return null;
}

function normalizePackageInput(input: HolidayPackageInput): HolidayPackageInput {
  return {
    package_name: sanitizeText(input.package_name, 160),
    package_description: sanitizeLongText(input.package_description, 5000),
    travel_date: sanitizeText(input.travel_date ?? "", 20) || null,
    travel_start_date: sanitizeText(input.travel_start_date ?? "", 20) || null,
    travel_end_date: sanitizeText(input.travel_end_date ?? "", 20) || null,
    itinerary_description: sanitizeLongText(input.itinerary_description ?? "", 10000),
    status: (input.status ?? "draft") as PackageStatus,
    flight_link: sanitizeText(input.flight_link ?? "", 500) || null,
    airline_name: sanitizeText(input.airline_name ?? "", 120) || null,
    departure_city: sanitizeText(input.departure_city ?? "", 120) || null,
    arrival_city: sanitizeText(input.arrival_city ?? "", 120) || null,
    itinerary: input.itinerary.map((item, index) => ({
      day_number: Number(item.day_number) || index + 1,
      title: sanitizeText(item.title, 200),
      description: sanitizeLongText(item.description, 10000),
    })),
    addons: input.addons.map((addon) => ({
      addon_key: sanitizeText(addon.addon_key, 80),
      addon_label: sanitizeText(addon.addon_label, 120),
      enabled: Boolean(addon.enabled),
      price: Number(addon.price) || 0,
    })),
    hotels: (input.hotels ?? []).map((hotel) => ({
      hotel_name: sanitizeText(hotel.hotel_name, 160),
      hotel_category: sanitizeText(hotel.hotel_category, 80),
      room_category: sanitizeText(hotel.room_category, 80),
      city: sanitizeText(hotel.city ?? "", 120),
      notes: sanitizeLongText(hotel.notes ?? "", 1000),
    })),
    passenger_details: {
      number_of_passengers: Number(input.passenger_details.number_of_passengers),
      number_of_rooms: Number(input.passenger_details.number_of_rooms),
      room_category: sanitizeText(input.passenger_details.room_category, 80),
      hotel_category: sanitizeText(input.passenger_details.hotel_category, 80),
      hotel_name: sanitizeText(input.passenger_details.hotel_name, 160),
    },
  };
}

export function listHolidayPackages() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, package_name, status, travel_date, travel_start_date, travel_end_date, updated_at
       FROM holiday_packages
       ORDER BY updated_at DESC`
    )
    .all() as Array<{
    id: string;
    package_name: string;
    status: PackageStatus;
    travel_date: string | null;
    travel_start_date: string | null;
    travel_end_date: string | null;
    updated_at: string;
  }>;

  return rows;
}

function getPackageById(packageId: string) {
  const db = getDb();
  const pkg = db
    .prepare(
      `SELECT id, package_name, package_description, travel_date, travel_start_date, travel_end_date,
              itinerary_description, status, flight_link, airline_name, departure_city, arrival_city,
              created_at, updated_at
       FROM holiday_packages
       WHERE id = ?`
    )
    .get(packageId) as SqlPackageRow | undefined;

  if (!pkg) return null;

  const itinerary = db
    .prepare(
      `SELECT day_number, title, description
       FROM package_itinerary
       WHERE package_id = ?
       ORDER BY sort_order ASC, day_number ASC`
    )
    .all(packageId) as PackageItineraryInput[];

  const addons = db
    .prepare(
      `SELECT addon_key, addon_label, enabled, price
       FROM package_addons
       WHERE package_id = ?
       ORDER BY addon_label ASC`
    )
    .all(packageId) as Array<{
    addon_key: string;
    addon_label: string;
    enabled: number;
    price: number;
  }>;

  const hotels = db
    .prepare(
      `SELECT hotel_name, hotel_category, room_category, city, notes
       FROM package_hotels
       WHERE package_id = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .all(packageId) as PackageHotelInput[];

  const passenger = db
    .prepare(
      `SELECT number_of_passengers, number_of_rooms, room_category, hotel_category, hotel_name
       FROM package_passenger_details
       WHERE package_id = ?`
    )
    .get(packageId) as PackagePassengerInput | undefined;
  const passengerDetails: PackagePassengerInput = passenger ?? {
    number_of_passengers: 1,
    number_of_rooms: 1,
    room_category: "Standard",
    hotel_category: "3 Star",
    hotel_name: "",
  };

  return {
    ...pkg,
    itinerary,
    addons: addons.map((addon) => ({ ...addon, enabled: addon.enabled === 1 })),
    hotels,
    passenger_details: passengerDetails,
  };
}

function savePackageRelations(packageId: string, input: HolidayPackageInput) {
  const db = getDb();

  db.prepare("DELETE FROM package_itinerary WHERE package_id = ?").run(packageId);
  db.prepare("DELETE FROM package_addons WHERE package_id = ?").run(packageId);
  db.prepare("DELETE FROM package_hotels WHERE package_id = ?").run(packageId);

  const insertItinerary = db.prepare(
    `INSERT INTO package_itinerary (id, package_id, day_number, title, description, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  input.itinerary.forEach((item, index) => {
    insertItinerary.run(
      crypto.randomUUID(),
      packageId,
      item.day_number || index + 1,
      item.title,
      item.description,
      index
    );
  });

  const insertAddon = db.prepare(
    `INSERT INTO package_addons (id, package_id, addon_key, addon_label, enabled, price)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  input.addons.forEach((addon) => {
    insertAddon.run(
      crypto.randomUUID(),
      packageId,
      addon.addon_key,
      addon.addon_label,
      addon.enabled ? 1 : 0,
      addon.price
    );
  });

  const insertHotel = db.prepare(
    `INSERT INTO package_hotels (id, package_id, hotel_name, hotel_category, room_category, city, notes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  input.hotels.forEach((hotel, index) => {
    insertHotel.run(
      crypto.randomUUID(),
      packageId,
      hotel.hotel_name,
      hotel.hotel_category,
      hotel.room_category,
      hotel.city ?? "",
      hotel.notes ?? "",
      index
    );
  });

  db.prepare(
    `INSERT INTO package_passenger_details (
       id, package_id, number_of_passengers, number_of_rooms, room_category, hotel_category, hotel_name, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(package_id) DO UPDATE SET
       number_of_passengers = excluded.number_of_passengers,
       number_of_rooms = excluded.number_of_rooms,
       room_category = excluded.room_category,
       hotel_category = excluded.hotel_category,
       hotel_name = excluded.hotel_name,
       updated_at = datetime('now')`
  ).run(
    crypto.randomUUID(),
    packageId,
    input.passenger_details.number_of_passengers,
    input.passenger_details.number_of_rooms,
    input.passenger_details.room_category,
    input.passenger_details.hotel_category,
    input.passenger_details.hotel_name
  );
}

export function createHolidayPackage(input: HolidayPackageInput) {
  const validationError = validatePackageInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const normalized = normalizePackageInput(input);
  const db = getDb();
  const id = crypto.randomUUID();

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO holiday_packages (
         id, package_name, package_description, travel_date, travel_start_date, travel_end_date,
         itinerary_description, status, flight_link, airline_name, departure_city, arrival_city
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      normalized.package_name,
      normalized.package_description,
      normalized.travel_date,
      normalized.travel_start_date,
      normalized.travel_end_date,
      normalized.itinerary_description ?? "",
      normalized.status ?? "draft",
      normalized.flight_link,
      normalized.airline_name,
      normalized.departure_city,
      normalized.arrival_city
    );

    savePackageRelations(id, normalized);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getPackageById(id);
}

export function updateHolidayPackage(packageId: string, input: HolidayPackageInput) {
  const validationError = validatePackageInput(input);
  if (validationError) {
    throw new Error(validationError);
  }
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM holiday_packages WHERE id = ?")
    .get(packageId) as { id: string } | undefined;
  if (!existing) {
    throw new Error("Package not found");
  }

  const normalized = normalizePackageInput(input);

  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE holiday_packages
       SET package_name = ?,
           package_description = ?,
           travel_date = ?,
           travel_start_date = ?,
           travel_end_date = ?,
           itinerary_description = ?,
           status = ?,
           flight_link = ?,
           airline_name = ?,
           departure_city = ?,
           arrival_city = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      normalized.package_name,
      normalized.package_description,
      normalized.travel_date,
      normalized.travel_start_date,
      normalized.travel_end_date,
      normalized.itinerary_description ?? "",
      normalized.status ?? "draft",
      normalized.flight_link,
      normalized.airline_name,
      normalized.departure_city,
      normalized.arrival_city,
      packageId
    );

    savePackageRelations(packageId, normalized);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getPackageById(packageId);
}

export function deleteHolidayPackage(packageId: string): void {
  const db = getDb();
  const result = db.prepare("DELETE FROM holiday_packages WHERE id = ?").run(packageId);
  if (!result.changes) {
    throw new Error("Package not found");
  }
}

export function getHolidayPackage(packageId: string) {
  const packageData = getPackageById(packageId);
  if (!packageData) throw new Error("Package not found");
  return packageData;
}

export function duplicateHolidayPackage(packageId: string) {
  const existing = getPackageById(packageId);
  if (!existing) throw new Error("Package not found");

  const cloneInput: HolidayPackageInput = {
    package_name: `${existing.package_name} (Copy)`,
    package_description: existing.package_description,
    travel_date: existing.travel_date,
    travel_start_date: existing.travel_start_date,
    travel_end_date: existing.travel_end_date,
    itinerary_description: existing.itinerary_description,
    status: "draft",
    flight_link: existing.flight_link,
    airline_name: existing.airline_name,
    departure_city: existing.departure_city,
    arrival_city: existing.arrival_city,
    itinerary: existing.itinerary,
    addons: existing.addons,
    hotels: existing.hotels,
    passenger_details: existing.passenger_details,
  };

  return createHolidayPackage(cloneInput);
}

export function getDestinationMeta() {
  return {
    continents: [...allowedContinents],
  };
}
