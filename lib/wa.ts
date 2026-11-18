import { rp, tgl, waNumber } from './format';

type P = { nama: string; kode: string; hp: string; hewan_nama: string | null; saldo: number; kurang: number };

export function waLink(hp: string, text: string): string | null {
  const n = waNumber(hp);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

export function pesanKode(p: P, origin: string, masjid: string) {
  return `Assalamu'alaikum ${p.nama}. Berikut kode tabungan qurban ${masjid}: *${p.kode}*\n\nCek saldo dan konfirmasi setoran di:\n${origin}/p/${p.kode}\n\nMohon kode ini tidak dibagikan ke orang lain.`;
}

export function pesanTagihan(p: P, origin: string, batas: string) {
  return `Assalamu'alaikum ${p.nama}. Mengingatkan tabungan qurban ${p.hewan_nama ?? ''} saat ini ${rp(p.saldo)}, masih kurang ${rp(p.kurang)}.${batas ? ` Batas pelunasan ${tgl(batas, true)}.` : ''}\n\nDetail dan konfirmasi setoran:\n${origin}/p/${p.kode}\n\nJazakallahu khairan.`;
}
