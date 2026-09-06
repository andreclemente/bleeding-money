import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from './client'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL é obrigatória')
await migrate(createDb(url), { migrationsFolder: './drizzle' })
console.log('Migrations aplicadas')
