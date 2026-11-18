import 'server-only';
import { one, q } from './db';

/** Sudah melewati batas? (tidak menambah hitungan) */
export async function isLimited(kunci: string, batas: number, detik: number): Promise<boolean> {
  const r = await one<{ jumlah: number; mulai: string }>('select jumlah, mulai from batas_akses where kunci = $1', [kunci]);
  if (!r) return false;
  if (Date.now() - Date.parse(r.mulai) > detik * 1000) return false;
  return r.jumlah >= batas;
}

/** Tambah satu hitungan pada jendela waktu berjalan. */
export async function hit(kunci: string, detik: number) {
  const r = await one<{ jumlah: number; mulai: string }>('select jumlah, mulai from batas_akses where kunci = $1', [kunci]);
  const now = new Date().toISOString();
  if (!r || Date.now() - Date.parse(r.mulai) > detik * 1000) {
    await q(
      `insert into batas_akses (kunci, jumlah, mulai) values ($1, 1, $2)
       on conflict (kunci) do update set jumlah = 1, mulai = excluded.mulai`,
      [kunci, now],
    );
  } else {
    await q('update batas_akses set jumlah = jumlah + 1 where kunci = $1', [kunci]);
  }
}

export async function clearHits(kunci: string) {
  await q('delete from batas_akses where kunci = $1', [kunci]);
}
