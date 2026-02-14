// src/app/lib/db.ts
import { Pool } from "pg";

declare global {
  // evita recriar pool em hot-reload no dev
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não definida no .env.local");
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") global.__pgPool = pool;
