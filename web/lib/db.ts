import pg from "pg";

const globalForPg = global as unknown as { __pgPool?: pg.Pool };

export const pool =
  globalForPg.__pgPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForPg.__pgPool = pool;
