import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export * from "./schema";
export * from "./validators";

type Database = PostgresJsDatabase<typeof schema>;

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (typeof globalThis.window !== "undefined") {
    throw new Error("Database cannot be initialized on the client");
  }

  if (_db) return _db;

  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const client = postgres(connectionString);
  _db = drizzle(client, { schema });
  return _db;
}
