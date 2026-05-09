import { defineConfig } from "drizzle-kit";

const configuredSchema = process.env.DB_SCHEMA?.trim()
const schemaFilter = configuredSchema && configuredSchema.toLowerCase() !== 'public'
  ? [configuredSchema]
  : undefined

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './supabase/migrations',
  ...(schemaFilter ? { schemaFilter } : {}),
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
