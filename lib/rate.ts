import 'server-only';
import { one, q } from './db';

/** Sudah melewati batas? (tidak menambah hitungan) */
export async function isLimited(kunci: string, batas: number, detik: number): Promise<boolean> {
  const r = await one<{ jumlah: number; mulai: Date }>('select jumlah, mulai from batas_akses where kunci = $1', [kunci]);
  if (!r) return false;
  if (Date.now() - new Date(r.mulai).getTime() > detik * 1000) return false;
  return r.jumlah >= batas;
}

/** Tambah satu hitungan pada jendela waktu berjalan. */
export async function hit(kunci: string, detik: number) {
  await q(
    `insert into batas_akses (kunci, jumlah, mulai) values ($1, 1, now())
     on conflict (kunci) do update set
       jumlah = case when batas_akses.mulai < now() - make_interval(secs => $2) then 1 else batas_akses.jumlah + 1 end,
       mulai  = case when batas_akses.mulai < now() - make_interval(secs => $2) then now() else batas_akses.mulai end`,
    [kunci, detik],
  );
}

export async function clearHits(kunci: string) {
  await q('delete from batas_akses where kunci = $1', [kunci]);
}
