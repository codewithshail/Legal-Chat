import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL || "your_connection_string");

export const db: NeonHttpDatabase<typeof schema> = drizzle(sql, { schema });
