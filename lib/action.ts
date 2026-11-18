import 'server-only';
import { redirect } from 'next/navigation';
import { UserError } from './qurban';

export function safeBack(v: FormDataEntryValue | null, fallback: string): string {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : fallback;
}

function withMsg(path: string, key: 'ok' | 'err', msg: string) {
  const [base, qs = ''] = path.split('?');
  const p = new URLSearchParams(qs);
  p.delete('ok');
  p.delete('err');
  p.set(key, msg);
  return `${base}?${p.toString()}`;
}

/** Jalankan aksi lalu kembali ke halaman dengan pesan sukses/gagal. */
export async function run(back: string, fn: () => Promise<string | { to: string; ok: string } | void>): Promise<never> {
  let to = back;
  let ok = 'Tersimpan.';
  let err = '';
  try {
    const r = await fn();
    if (typeof r === 'string') ok = r;
    else if (r) { to = r.to; ok = r.ok; }
  } catch (e) {
    if (e instanceof UserError) err = e.message;
    else {
      console.error(e);
      err = 'Terjadi kesalahan di server. Coba lagi.';
    }
  }
  redirect(err ? withMsg(back, 'err', err) : withMsg(to, 'ok', ok));
}

export const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
export const int = (f: FormData, k: string) => {
  const n = parseInt(String(f.get(k) ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
};
