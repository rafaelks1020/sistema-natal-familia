import { Pool, QueryResult, QueryResultRow } from 'pg';

// Postgres da VPS2 pelo pgbouncer (modo transação). Pool pequeno: na Vercel cada instância
// abre o seu, e o role natal_familia tem limite de 10 conexões.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const globalForPg = globalThis as unknown as { natalPool?: Pool };

function createPool(): Pool {
  if (!connectionString) {
    throw new Error('DATABASE_URL não está definida');
  }
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
  });
  // Sem ouvinte, uma conexão encerrada pelo servidor derruba o processo Node.
  pool.on('error', (err) => {
    console.error('[db] conexão ociosa caiu:', err.message);
  });
  return pool;
}

function getPool(): Pool {
  if (!globalForPg.natalPool) globalForPg.natalPool = createPool();
  return globalForPg.natalPool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as any[]);
}

/** Executa várias queries na mesma transação (mesma conexão). */
export async function transaction<T>(fn: (q: typeof query) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const q = (<R extends QueryResultRow = any>(text: string, params?: unknown[]) =>
      client.query<R>(text, params as any[])) as typeof query;
    const result = await fn(q);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
