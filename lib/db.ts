import 'server-only';
import { SCHEMA } from './schema';

/**
 * Lapisan database: Cloudflare D1 (SQLite) lewat HTTP API.
 * - Produksi (Vercel): CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_DATABASE_ID + CLOUDFLARE_API_TOKEN.
 * - Development lokal tanpa variabel itu: file SQLite di .data/local.db (node:sqlite).
 * Query ditulis dengan placeholder $1, $2, ... dan diubah menjadi ?1, ?2 (didukung D1 dan SQLite).
 */

export type Row = Record<string, any>;
export interface Conn {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}
export interface Driver extends Conn {
  /** Jalankan banyak statement sekaligus (tanpa parameter). */
  exec(sql: string): Promise<void>;
  tx<T>(fn: (c: Conn) => Promise<T>): Promise<T>;
}

const toQ = (sql: string) => sql.replace(/\$(\d+)/g, '?$1');
const norm = (params?: unknown[]) =>
  (params || []).map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

export function d1Config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  return accountId && databaseId && token ? { accountId, databaseId, token } : null;
}

// ---------------------------------------------------------------- Cloudflare D1 (HTTP)

export function d1Driver(cfg: { accountId: string; databaseId: string; token: string }, base = 'https://api.cloudflare.com/client/v4'): Driver {
  const url = `${base}/accounts/${cfg.accountId}/d1/database/${cfg.databaseId}/query`;
  async function call(body: unknown): Promise<any[]> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store',
        });
        const json: any = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          const msg = json?.errors?.map((e: any) => e.message).join('; ') || `HTTP ${res.status}`;
          const err = new Error('D1: ' + msg);
          // 4xx = kesalahan query/izin, jangan diulang
          if (res.status >= 400 && res.status < 500) throw Object.assign(err, { fatal: true });
          throw err;
        }
        return json.result as any[];
      } catch (e: any) {
        lastErr = e;
        if (e?.fatal) break;
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
    throw lastErr;
  }
  const d: Driver = {
    async query(sql, params) {
      const result = await call({ sql: toQ(sql), params: norm(params) });
      return (result?.[result.length - 1]?.results ?? []) as any[];
    },
    async exec(sql) {
      await call({ sql });
    },
    // D1 lewat HTTP tidak mendukung transaksi interaktif. Validasi dilakukan sebelum menulis,
    // sehingga kegagalan di tengah hanya terjadi bila jaringan putus.
    tx: (fn) => fn(d),
  };
  return d;
}

// ---------------------------------------------------------------- SQLite lokal (node:sqlite)

export async function sqliteDriver(file: string): Promise<Driver> {
  const { DatabaseSync } = await import('node:sqlite');
  if (file !== ':memory:') {
    const { mkdirSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    mkdirSync(dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  const plain = (r: any) => ({ ...r });
  const conn: Conn = {
    async query(sql, params) {
      const stmt = db.prepare(toQ(sql));
      return stmt.all(...(norm(params) as any[])).map(plain) as any[];
    },
  };
  // Satu koneksi: antrekan transaksi supaya tidak saling tumpang tindih.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T,>(f: () => Promise<T>): Promise<T> => {
    const p = chain.then(f, f);
    chain = p.catch(() => {});
    return p;
  };
  return {
    query: (sql, params) => serial(() => conn.query(sql, params)),
    exec: (sql) => serial(async () => { db.exec(sql); }),
    tx: (fn) =>
      serial(async () => {
        db.exec('BEGIN');
        try {
          const r = await fn(conn);
          db.exec('COMMIT');
          return r;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      }),
  };
}

// ---------------------------------------------------------------- pemilihan driver

const g = globalThis as unknown as { __qurbanDb?: Promise<Driver> };

export function dbConfigured(): boolean {
  return !!d1Config() || !process.env.VERCEL;
}

async function init(): Promise<Driver> {
  const cfg = d1Config();
  if (!cfg && process.env.VERCEL) {
    throw new Error('Database D1 belum diatur (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN).');
  }
  const d = cfg ? d1Driver(cfg, process.env.CLOUDFLARE_API_BASE || undefined) : await sqliteDriver('./.data/local.db');
  await d.exec(SCHEMA);
  return d;
}

export function driver(): Promise<Driver> {
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

/** Literal SQL untuk menyalin data (dipakai saat mengisi data dummy secara massal). */
export function lit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Kirim banyak statement dalam beberapa potongan (batas ukuran request D1). */
export async function execChunked(d: Driver, statements: string[], maxBytes = 90_000) {
  let buf: string[] = [];
  let size = 0;
  for (const s of statements) {
    if (size + s.length > maxBytes && buf.length) {
      await d.exec(buf.join(';\n') + ';');
      buf = [];
      size = 0;
    }
    buf.push(s);
    size += s.length + 2;
  }
  if (buf.length) await d.exec(buf.join(';\n') + ';');
}
