import { defineConfig } from "drizzle-kit";

const configuredSchema = process.env.DB_SCHEMA?.trim();
const useNamedSchema = Boolean(
  configuredSchema && configuredSchema.toLowerCase() !== "public",
);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  ...(useNamedSchema ? { schemaFilter: [configuredSchema] } : {}),
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
