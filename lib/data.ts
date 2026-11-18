import 'server-only';
import { one, q } from './db';
import { AKUN } from './qurban';

export type PekurbanRow = {
  id: number;
  kode: string;
  nama: string;
  hp: string;
  alamat: string;
  atas_nama: string;
  hewan_id: number | null;
  status: string;
  catatan: string;
  dibuat: string;
  hewan_nama: string | null;
  hewan_jenis: string | null;
  hewan_kapasitas: number | null;
  hewan_status: string | null;
  harga_estimasi: number | null;
  harga_realisasi: number | null;
  saldo: number;
  total_setor: number;
  menunggu: number;
  biaya: number;
  peny_tipe: string | null;
  peny_nominal: number | null;
  peny_tanggal: string | null;
  // turunan
  target: number | null;
  kurang: number;
  lunas: boolean;
};

const PK_SQL = `
select p.*, h.nama as hewan_nama, h.jenis as hewan_jenis, h.kapasitas as hewan_kapasitas, h.status as hewan_status,
  h.harga_estimasi, h.harga_realisasi,
  coalesce((select sum(b.kredit - b.debit) from jurnal_baris b where b.akun = '${AKUN.TITIPAN}' and b.pekurban_id = p.id), 0)::bigint as saldo,
  coalesce((select sum(s.nominal) from setoran s where s.pekurban_id = p.id and s.status = 'terverifikasi'), 0)::bigint as total_setor,
  coalesce((select sum(s.nominal) from setoran s where s.pekurban_id = p.id and s.status = 'menunggu'), 0)::bigint as menunggu,
  coalesce((select sum(b.debit) from jurnal_baris b join jurnal j on j.id = b.jurnal_id
            where j.jenis = 'sembelih' and b.akun = '${AKUN.TITIPAN}' and b.pekurban_id = p.id), 0)::bigint as biaya,
  y.tipe as peny_tipe, y.nominal as peny_nominal, y.tanggal as peny_tanggal
from pekurban p
left join hewan h on h.id = p.hewan_id
left join penyelesaian y on y.pekurban_id = p.id
`;

function derive(r: any): PekurbanRow {
  const biaya = Number(r.biaya) || 0;
  let target: number | null = null;
  if (biaya > 0) target = biaya;
  else if (r.hewan_kapasitas) target = Math.ceil(Number(r.harga_realisasi ?? r.harga_estimasi) / Number(r.hewan_kapasitas));
  // Setelah disembelih, porsi sudah didebit dari saldo; yang tersisa adalah sisa dana.
  const setor = Number(r.total_setor) || 0;
  const kurang = target == null || r.status !== 'aktif' || biaya > 0 ? 0 : Math.max(0, target - Number(r.saldo));
  return { ...r, target, kurang, lunas: target != null && (biaya > 0 || setor >= target) };
}

export async function listPekurban(where = '', params: unknown[] = []): Promise<PekurbanRow[]> {
  const rows = await q(`${PK_SQL} ${where} order by p.status = 'batal', h.nama nulls last, p.nama`, params);
  return rows.map(derive);
}
export async function getPekurbanById(id: number) {
  const r = await one(`${PK_SQL} where p.id = $1`, [id]);
  return r ? derive(r) : undefined;
}
export async function getPekurbanByKode(kode: string) {
  const r = await one(`${PK_SQL} where p.kode = $1`, [kode]);
  return r ? derive(r) : undefined;
}

export type HewanRow = {
  id: number;
  nama: string;
  jenis: string;
  kapasitas: number;
  harga_estimasi: number;
  harga_realisasi: number | null;
  status: string;
  tgl_beli: string | null;
  tgl_sembelih: string | null;
  nota_id: string | null;
  catatan: string;
  peserta: number;
  dana: number;
  menunggu: number;
};

export async function listHewan(): Promise<HewanRow[]> {
  return q<HewanRow>(`
    select h.*,
      (select count(*)::int from pekurban p where p.hewan_id = h.id and p.status <> 'batal') as peserta,
      coalesce((select sum(s.nominal) from setoran s join pekurban p on p.id = s.pekurban_id
                where p.hewan_id = h.id and p.status <> 'batal' and s.status = 'terverifikasi'), 0)::bigint as dana,
      coalesce((select sum(s.nominal) from setoran s join pekurban p on p.id = s.pekurban_id
                where p.hewan_id = h.id and p.status <> 'batal' and s.status = 'menunggu'), 0)::bigint as menunggu
    from hewan h order by h.jenis = 'sapi' desc, h.nama`);
}
export async function getHewanById(id: number) {
  return (await listHewan()).find((h) => h.id === id);
}

export type SetoranRow = {
  id: number;
  pekurban_id: number;
  tanggal: string;
  nominal: number;
  metode: string;
  status: string;
  alasan: string;
  bukti_id: string | null;
  sumber: string;
  catatan: string;
  dibuat: string;
  diverifikasi: string | null;
  nama: string;
  kode: string;
  hewan_nama: string | null;
  hewan_status: string | null;
  pekurban_status: string;
  bukti_mime: string | null;
};

export async function listSetoran(where = '', params: unknown[] = [], limit = 500): Promise<SetoranRow[]> {
  return q<SetoranRow>(
    `select s.*, p.nama, p.kode, p.status as pekurban_status, h.nama as hewan_nama, h.status as hewan_status, b.mime as bukti_mime
     from setoran s join pekurban p on p.id = s.pekurban_id left join hewan h on h.id = p.hewan_id
     left join berkas b on b.id = s.bukti_id
     ${where} order by s.status = 'menunggu' desc, s.tanggal desc, s.id desc limit ${limit}`,
    params,
  );
}

export async function saldoAkun(): Promise<Record<string, number>> {
  const rows = await q<{ akun: string; d: number; k: number }>(
    `select akun, coalesce(sum(debit),0)::bigint as d, coalesce(sum(kredit),0)::bigint as k from jurnal_baris group by akun`,
  );
  const out: Record<string, number> = {};
  for (const r of rows) {
    const normalDebit = r.akun.startsWith('1');
    out[r.akun] = normalDebit ? Number(r.d) - Number(r.k) : Number(r.k) - Number(r.d);
  }
  return out;
}

export async function ringkasan() {
  const [s] = await q<any>(`
    select
      coalesce(sum(case when status='terverifikasi' then nominal end),0)::bigint as ver,
      coalesce(sum(case when status='menunggu' then nominal end),0)::bigint as pend,
      count(case when status='menunggu' then 1 end)::int as pend_n,
      coalesce(sum(case when status='ditolak' then nominal end),0)::bigint as rej
    from setoran`);
  const [p] = await q<any>(`
    select count(case when status <> 'batal' then 1 end)::int as aktif,
           count(case when status <> 'batal' and hewan_id is null then 1 end)::int as tanpa_hewan
    from pekurban`);
  const akun = await saldoAkun();
  return {
    ver: Number(s.ver),
    pend: Number(s.pend),
    pendN: s.pend_n as number,
    rej: Number(s.rej),
    pekurban: p.aktif as number,
    tanpaHewan: p.tanpa_hewan as number,
    kas: akun[AKUN.KAS] || 0,
    persediaan: akun[AKUN.PERSEDIAAN] || 0,
    titipan: akun[AKUN.TITIPAN] || 0,
    infak: akun[AKUN.INFAK] || 0,
  };
}

export async function jumlahMenunggu(): Promise<number> {
  const r = await one<{ n: number }>(`select count(*)::int as n from setoran where status='menunggu'`);
  return r?.n || 0;
}
