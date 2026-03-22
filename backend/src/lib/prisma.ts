import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || typeof databaseUrl !== 'string') {
  throw new Error('DATABASE_URL is not set. Please configure backend/.env with a valid PostgreSQL connection string.');
}

const parsedDatabaseUrl = new URL(databaseUrl);
const pool = new Pool({
  host: parsedDatabaseUrl.hostname,
  port: Number(parsedDatabaseUrl.port || 5432),
  user: decodeURIComponent(parsedDatabaseUrl.username),
  password: String(decodeURIComponent(parsedDatabaseUrl.password || '')),
  database: decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, '')),
  ssl: { rejectUnauthorized: false },
});

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});
