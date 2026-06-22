import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('WARNING: DATABASE_URL environment variable is not defined.');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')
    ? { rejectUnauthorized: false }
    : false,
  max: 20, // Connection pool size limit
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export default pool;
