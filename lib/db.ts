import 'server-only';
import { Pool, types } from 'pg';
import { SCHEMA } from './schema';

// int8 (uang) -> number, numeric -> number, date -> string 'YYYY-MM-DD' (hindari geser zona waktu)
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(1082, (v) => v);

export type Row = Record<string, any>;
export interface Conn {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}
interface Driver extends Conn {
  exec(sql: string): Promise<void>;
  tx<T>(fn: (c: Conn) => Promise<T>): Promise<T>;
}

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

function pgDriver(url: string): Driver {
  const pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000 });
  return {
    async query(sql, params) {
      const r = await pool.query(sql, params as any[]);
      return r.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const res = await fn({
          async query(sql, params) {
            const r = await client.query(sql, params as any[]);
            return r.rows;
          },
        });
        await client.query('COMMIT');
        return res;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function pgliteDriver(): Promise<Driver> {
  const { PGlite } = await import('@electric-sql/pglite');
  const parsers = {
    20: (v: string) => parseInt(v, 10),
    1700: (v: string) => parseFloat(v),
    1082: (v: string) => v,
  };
  const { mkdirSync } = await import('node:fs');
  mkdirSync('./.data', { recursive: true });
  const db = new PGlite('./.data/pglite', { parsers });
  // PGlite hanya satu koneksi: antrekan transaksi supaya tidak saling tumpang tindih.
  let chain: Promise<unknown> = Promise.resolve();
  const run = <T,>(f: () => Promise<T>): Promise<T> => {
    const p = chain.then(f, f);
    chain = p.catch(() => {});
    return p;
  };
  return {
    query: (sql, params) => run(async () => (await db.query(sql, params as any[])).rows as any[]),
    exec: (sql) => run(async () => { await db.exec(sql); }),
    tx: (fn) =>
      run(() =>
        db.transaction(async (t) =>
          fn({ async query(sql, params) { return (await t.query(sql, params as any[])).rows as any[]; } }),
        ),
      ),
  };
}

const g = globalThis as unknown as { __qurbanDb?: Promise<Driver> };

async function init(): Promise<Driver> {
  const url = databaseUrl();
  if (!url && process.env.VERCEL) {
    throw new Error('DATABASE_URL belum diatur. Hubungkan database Neon ke project Vercel.');
  }
  const d = url ? pgDriver(url) : await pgliteDriver();
  await d.exec(SCHEMA);
  return d;
}

function driver(): Promise<Driver> {
  if (!g.__qurbanDb) {
    g.__qurbanDb = init().catch((e) => {
      g.__qurbanDb = undefined;
      throw e;
    });
  }
  return g.__qurbanDb;
}

export async function q<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
  return (await driver()).query<T>(sql, params);
}
export async function one<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined> {
  return (await q<T>(sql, params))[0];
}
export async function tx<T>(fn: (c: Conn) => Promise<T>): Promise<T> {
  return (await driver()).tx(fn);
}
