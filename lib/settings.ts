import 'server-only';
import { one, q } from './db';

export type Pengaturan = {
  namaMasjid: string;
  alamatMasjid: string;
  periode: string;
  bank: string;
  noRekening: string;
  atasNamaRekening: string;
  waPanitia: string;
  tanggalIdulAdha: string;
  batasPelunasan: string;
  pengumuman: string;
  namaBendahara: string;
  namaKetua: string;
  saldoBank: number | null;
  tanggalSaldoBank: string;
};

export const DEFAULT_PENGATURAN: Pengaturan = {
  namaMasjid: 'Masjid Baitul Makmur',
  alamatMasjid: '',
  periode: 'Qurban 1448 H / 2027',
  bank: 'Bank Syariah Indonesia',
  noRekening: '',
  atasNamaRekening: '',
  waPanitia: '',
  tanggalIdulAdha: '2027-05-16',
  batasPelunasan: '2027-04-30',
  pengumuman: '',
  namaBendahara: '',
  namaKetua: '',
  saldoBank: null,
  tanggalSaldoBank: '',
};

export async function getPengaturan(): Promise<Pengaturan> {
  const r = await one<{ data: Partial<Pengaturan> }>('select data from pengaturan where id = 1');
  return { ...DEFAULT_PENGATURAN, ...(r?.data || {}) };
}

export async function setPengaturan(p: Partial<Pengaturan>) {
  const cur = await getPengaturan();
  const data = { ...cur, ...p };
  await q(
    `insert into pengaturan (id, data) values (1, $1::jsonb)
     on conflict (id) do update set data = excluded.data`,
    [JSON.stringify(data)],
  );
}
