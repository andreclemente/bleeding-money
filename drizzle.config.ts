import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória para comandos Drizzle')

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true
})
