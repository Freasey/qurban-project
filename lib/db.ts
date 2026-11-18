import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SCHEMA } from './schema';

/**
 * Lapisan database: Cloudflare D1 lewat binding `DB` (lihat wrangler.jsonc).
 * Di `next dev`, binding disediakan oleh miniflare (D1 lokal di folder .wrangler/).
 * Query ditulis dengan placeholder $1, $2, ... dan diubah menjadi ?1, ?2.
 */

export type Row = Record<string, any>;
export interface Conn {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

// Tipe minimal D1 supaya tidak bergantung pada paket tipe Workers.
interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  all<T = Row>(): Promise<{ results: T[] }>;
}
interface D1 {
  prepare(sql: string): D1Stmt;
  batch(stmts: D1Stmt[]): Promise<unknown[]>;
}

const toQ = (sql: string) => sql.replace(/\$(\d+)/g, '?$1');
const norm = (params?: unknown[]) =>
  (params || []).map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

let schemaReady: Promise<void> | null = null;

async function d1(): Promise<D1> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as { DB?: D1 }).DB;
  if (!db) throw new Error('Binding D1 "DB" tidak ditemukan. Periksa d1_databases di wrangler.jsonc.');
  if (!schemaReady) {
    schemaReady = db.batch(SCHEMA.map((s) => db.prepare(s))).then(
      () => undefined,
      (e) => {
        schemaReady = null;
        throw e;
      },
    );
  }
  await schemaReady;
  return db;
}

const conn: Conn = {
  async query(sql, params) {
    const db = await d1();
    const r = await db.prepare(toQ(sql)).bind(...norm(params)).all();
    return r.results as any[];
  },
};

export async function q<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
  return conn.query<T>(sql, params);
}
export async function one<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined> {
  return (await q<T>(sql, params))[0];
}

/**
 * D1 tidak mendukung transaksi interaktif. Semua validasi dijalankan sebelum menulis,
 * sehingga kegagalan di tengah hanya terjadi bila koneksi ke D1 terputus.
 */
export async function tx<T>(fn: (c: Conn) => Promise<T>): Promise<T> {
  return fn(conn);
}

/** Jalankan banyak statement (tanpa parameter) dalam beberapa batch. Dipakai untuk data massal. */
export async function batchExec(statements: string[], size = 80) {
  const db = await d1();
  for (let i = 0; i < statements.length; i += size) {
    await db.batch(statements.slice(i, i + size).map((s) => db.prepare(s)));
  }
}

/** Literal SQL untuk menyalin data massal. */
export function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}
