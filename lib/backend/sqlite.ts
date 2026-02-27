import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const migrationsDir = path.join(process.cwd(), "db", "migrations");

let db: DatabaseSync | null = null;
let initialized = false;
let runtimeDir: string | null = null;

function resolveRuntimeDir(): string {
  if (runtimeDir) return runtimeDir;

  const explicitDir = process.env.SQLITE_RUNTIME_DIR?.trim();
  const candidates = [
    explicitDir,
    path.join(process.cwd(), ".runtime"),
    path.join("/tmp", "yono-dmc-runtime"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) {
        mkdirSync(candidate, { recursive: true });
      }
      runtimeDir = candidate;
      return runtimeDir;
    } catch {
      // Try the next candidate directory.
    }
  }

  throw new Error("Unable to initialize runtime directory for SQLite.");
}

function getDatabaseFilePath(): string {
  return path.join(resolveRuntimeDir(), "travel.sqlite");
}

function ensureRuntimeDir(): void {
  resolveRuntimeDir();
}

function runMigrations(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const getMigration = database.prepare(
    "SELECT filename FROM schema_migrations WHERE filename = ?"
  );
  const addMigration = database.prepare(
    "INSERT INTO schema_migrations (filename) VALUES (?)"
  );

  for (const file of files) {
    const existing = getMigration.get(file);
    if (existing) continue;

    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    database.exec(sql);
    addMigration.run(file);
  }
}

export function getDb(): DatabaseSync {
  if (db && initialized) return db;

  ensureRuntimeDir();
  db = new DatabaseSync(getDatabaseFilePath());
  db.exec("PRAGMA foreign_keys = ON;");

  if (!initialized) {
    runMigrations(db);
    initialized = true;
  }

  return db;
}
