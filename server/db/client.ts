import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

const pools = new Map<string, pg.Pool>()
export const createDb = (url: string) => {
  let pool = pools.get(url)
  if (!pool) {
    pool = new pg.Pool({ connectionString: url })
    pools.set(url, pool)
  }
  return drizzle(pool, { schema })
}
