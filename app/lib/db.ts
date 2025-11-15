import { Pool, QueryResult } from 'pg';

// Cliente PostgreSQL compartilhado usando DATABASE_URL/POSTGRES_URL
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL ou POSTGRES_URL não está definida');
}

const pool = new Pool({
  connectionString,
});

export async function query(text: string, params?: any[]): Promise<QueryResult<any>> {
  const result = await pool.query(text, params);
  return result;
}
