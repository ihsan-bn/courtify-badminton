import pg, {
  type PoolClient,
  type QueryResult,
  type QueryResultRow
} from "pg";

import { env } from "./env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle: false,
  application_name: "courtify-badminton-api"
});

pool.on("error", (error) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "Unexpected idle PostgreSQL client error",
      error: error.message
    })
  );
});

export async function query<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, [...values]);
}

export async function queryWithClient<T extends QueryResultRow>(
  client: PoolClient,
  text: string,
  values: readonly unknown[] = []
): Promise<QueryResult<T>> {
  return client.query<T>(text, [...values]);
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  // Keep all state changes on one client and guarantee rollback on failure.
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
