import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Conn } from './db';
import { rp, today } from './format';

export const AKUN = {
  KAS: '1-1100',
  PERSEDIAAN: '1-1200',
  TITIPAN: '2-1100',
  INFAK: '4-1100',
} as const;

export const DAFTAR_AKUN: [string, string, string][] = [
  [AKUN.KAS, 'Kas/Bank rekening qurban', 'Aset'],
  [AKUN.PERSEDIAAN, 'Persediaan hewan qurban', 'Aset'],
  [AKUN.TITIPAN, 'Titipan dana qurban', 'Kewajiban'],
  [AKUN.INFAK, 'Pendapatan infak sisa qurban', 'Pendapatan'],
];
export const NAMA_AKUN: Record<string, string> = Object.fromEntries(DAFTAR_AKUN.map((a) => [a[0], a[1]]));

export const ATURAN_POSTING: [string, string, string][] = [
  ['Setoran diverifikasi', 'Kas/Bank', 'Titipan dana qurban (per pekurban)'],
  ['Verifikasi dibatalkan', 'Titipan dana qurban', 'Kas/Bank (jurnal pembalik)'],
  ['Hewan dibeli, nota diunggah', 'Persediaan hewan', 'Kas/Bank'],
  ['Pembelian dibatalkan', 'Kas/Bank', 'Persediaan hewan (jurnal pembalik)'],
  ['Hewan disembelih dan dibagi', 'Titipan dana qurban (porsi tiap pekurban)', 'Persediaan hewan'],
  ['Pekurban batal, dana dikembalikan', 'Titipan dana qurban', 'Kas/Bank'],
  ['Sisa saldo dikembalikan', 'Titipan dana qurban', 'Kas/Bank'],
  ['Sisa saldo jadi infak', 'Titipan dana qurban', 'Pendapatan infak'],
];

export class UserError extends Error {}
const fail = (m: string): never => {
  throw new UserError(m);
};

// ---------------------------------------------------------------- kode & log

const ALFABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function randomKode(): string {
  const b = randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += ALFABET[b[i] % ALFABET.length];
  return 'QB-' + s;
}
export function normalizeKode(input: string): string {
  const s = (input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const body = s.startsWith('QB') && s.length === 8 ? s.slice(2) : s;
  return 'QB-' + body;
}
export async function newKode(c: Conn): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const k = randomKode();
    const r = await c.query('select 1 from pekurban where kode = $1', [k]);
    if (!r.length) return k;
  }
  return fail('Gagal membuat kode unik, coba lagi.');
}

export async function logAksi(c: Conn, aksi: string, detail = '') {
  await c.query('insert into log_aktivitas (aksi, detail) values ($1, $2)', [aksi, detail]);
}

// ---------------------------------------------------------------- berkas

export const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
// D1 membatasi ukuran satu nilai ±2 MB; berkas disimpan base64 (+33%).
export const MAX_BERKAS = 1_400_000;

export async function simpanBerkas(c: Conn, file: File | null | undefined, wajib = false): Promise<string | null> {
  if (!file || typeof file === 'string' || file.size === 0) {
    if (wajib) fail('Lampirkan foto bukti transfer.');
    return null;
  }
  if (!MIME_OK.includes(file.type)) fail('Format berkas harus JPG, PNG, WEBP, atau PDF.');
  if (file.size > MAX_BERKAS) fail('Ukuran berkas maksimal 1,4 MB. Foto otomatis dikecilkan; untuk PDF, kompres dulu.');
  const buf = Buffer.from(await file.arrayBuffer());
  return simpanBuffer(c, buf, file.type, file.name);
}

export async function simpanBuffer(c: Conn, buf: Buffer, mime: string, nama = ''): Promise<string> {
  const id = randomUUID();
  await c.query('insert into berkas (id, nama, mime, ukuran, isi) values ($1, $2, $3, $4, $5)', [
    id,
    nama.slice(0, 200),
    mime,
    buf.length,
    buf.toString('base64'),
  ]);
  return id;
}

// ---------------------------------------------------------------- jurnal

type Baris = { akun: string; pekurban_id?: number | null; debit?: number; kredit?: number };
type JurnalInput = {
  tanggal: string;
  keterangan: string;
  jenis: string;
  pekurban_id?: number | null;
  hewan_id?: number | null;
  setoran_id?: number | null;
  pembalik_dari?: number | null;
  baris: Baris[];
};

export async function postJurnal(c: Conn, j: JurnalInput): Promise<number> {
  const d = j.baris.reduce((a, b) => a + (b.debit || 0), 0);
  const k = j.baris.reduce((a, b) => a + (b.kredit || 0), 0);
  if (d !== k || d <= 0) fail('Jurnal tidak seimbang.');
  const [r] = await c.query<{ id: number }>(
    `insert into jurnal (tanggal, keterangan, jenis, pekurban_id, hewan_id, setoran_id, pembalik_dari)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [j.tanggal, j.keterangan, j.jenis, j.pekurban_id ?? null, j.hewan_id ?? null, j.setoran_id ?? null, j.pembalik_dari ?? null],
  );
  for (const b of j.baris) {
    await c.query('insert into jurnal_baris (jurnal_id, akun, pekurban_id, debit, kredit) values ($1,$2,$3,$4,$5)', [
      r.id,
      b.akun,
      b.pekurban_id ?? null,
      b.debit || 0,
      b.kredit || 0,
    ]);
  }
  return r.id;
}

async function balikJurnal(c: Conn, jurnalId: number, tanggal: string, alasan: string, jenis: string) {
  const [j] = await c.query('select * from jurnal where id = $1', [jurnalId]);
  if (!j) fail('Jurnal tidak ditemukan.');
  if (j.dibalik) fail('Jurnal ini sudah pernah dibalik.');
  const baris = await c.query('select * from jurnal_baris where jurnal_id = $1 order by id', [jurnalId]);
  await postJurnal(c, {
    tanggal,
    keterangan: `Pembalik J-${String(jurnalId).padStart(4, '0')}: ${alasan}`,
    jenis,
    pekurban_id: j.pekurban_id,
    hewan_id: j.hewan_id,
    setoran_id: j.setoran_id,
    pembalik_dari: jurnalId,
    baris: baris.map((b) => ({ akun: b.akun, pekurban_id: b.pekurban_id, debit: b.kredit, kredit: b.debit })),
  });
  await c.query('update jurnal set dibalik = true where id = $1', [jurnalId]);
}

export async function saldoTitipan(c: Conn, pekurbanId: number): Promise<number> {
  const [r] = await c.query<{ s: number }>(
    `select coalesce(sum(kredit - debit), 0) as s from jurnal_baris where akun = $1 and pekurban_id = $2`,
    [AKUN.TITIPAN, pekurbanId],
  );
  return Number(r?.s || 0);
}

// ---------------------------------------------------------------- pekurban

async function getPekurban(c: Conn, id: number, lock = false) {
  const [p] = await c.query(`select * from pekurban where id = $1`, [id]);
  if (!p) fail('Pekurban tidak ditemukan.');
  return p;
}
async function getHewan(c: Conn, id: number, lock = false) {
  const [h] = await c.query(`select * from hewan where id = $1`, [id]);
  if (!h) fail('Hewan tidak ditemukan.');
  return h;
}
async function jumlahPeserta(c: Conn, hewanId: number, kecuali?: number): Promise<number> {
  const [r] = await c.query<{ n: number }>(
    `select count(*) as n from pekurban where hewan_id = $1 and status <> 'batal' and id <> $2`,
    [hewanId, kecuali ?? 0],
  );
  return r.n;
}

export async function cekPenempatan(c: Conn, hewanId: number | null, pekurbanId?: number) {
  if (!hewanId) return;
  const h = await getHewan(c, hewanId, true);
  if (h.status === 'disembelih') fail(`${h.nama} sudah disembelih, tidak bisa menambah peserta.`);
  const n = await jumlahPeserta(c, hewanId, pekurbanId);
  if (n >= h.kapasitas) fail(`${h.nama} sudah penuh (${h.kapasitas} slot).`);
}

export type PekurbanInput = { nama: string; hp: string; alamat: string; atas_nama: string; hewan_id: number | null; catatan: string };

export async function tambahPekurban(c: Conn, d: PekurbanInput): Promise<{ id: number; kode: string }> {
  if (!d.nama.trim()) fail('Nama wajib diisi.');
  await cekPenempatan(c, d.hewan_id);
  const kode = await newKode(c);
  const [r] = await c.query<{ id: number }>(
    `insert into pekurban (kode, nama, hp, alamat, atas_nama, hewan_id, catatan) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [kode, d.nama.trim(), d.hp.trim(), d.alamat.trim(), d.atas_nama.trim(), d.hewan_id, d.catatan.trim()],
  );
  await logAksi(c, 'Tambah pekurban', `${d.nama} (${kode})`);
  return { id: r.id, kode };
}

export async function ubahPekurban(c: Conn, id: number, d: PekurbanInput) {
  const p = await getPekurban(c, id, true);
  if (!d.nama.trim()) fail('Nama wajib diisi.');
  if ((p.hewan_id ?? null) !== (d.hewan_id ?? null)) {
    if (p.status !== 'aktif') fail('Hanya pekurban aktif yang bisa dipindah hewan.');
    if (p.hewan_id) {
      const lama = await getHewan(c, p.hewan_id);
      if (lama.status === 'disembelih') fail(`${lama.nama} sudah disembelih, pekurban tidak bisa dipindah.`);
    }
    await cekPenempatan(c, d.hewan_id, id);
  }
  await c.query(
    `update pekurban set nama=$2, hp=$3, alamat=$4, atas_nama=$5, hewan_id=$6, catatan=$7 where id=$1`,
    [id, d.nama.trim(), d.hp.trim(), d.alamat.trim(), d.atas_nama.trim(), d.hewan_id, d.catatan.trim()],
  );
  await logAksi(c, 'Ubah pekurban', `${d.nama} (${p.kode})`);
}

export async function gantiKode(c: Conn, id: number): Promise<string> {
  const p = await getPekurban(c, id, true);
  const kode = await newKode(c);
  await c.query('update pekurban set kode = $2 where id = $1', [id, kode]);
  await logAksi(c, 'Ganti kode pekurban', `${p.nama}: ${p.kode} → ${kode}`);
  return kode;
}

export async function hapusPekurban(c: Conn, id: number) {
  const p = await getPekurban(c, id, true);
  const [r] = await c.query<{ n: number }>('select count(*) as n from setoran where pekurban_id = $1', [id]);
  if (r.n > 0) fail('Pekurban yang sudah punya riwayat setoran tidak bisa dihapus. Gunakan "Batalkan pekurban".');
  await c.query('delete from pekurban where id = $1', [id]);
  await logAksi(c, 'Hapus pekurban', `${p.nama} (${p.kode})`);
}

export async function batalkanPekurban(c: Conn, id: number, tanggal: string, alasan: string) {
  const p = await getPekurban(c, id, true);
  if (p.status !== 'aktif') fail('Pekurban ini sudah tidak aktif.');
  if (p.hewan_id) {
    const h = await getHewan(c, p.hewan_id);
    if (h.status === 'disembelih') fail('Hewan sudah disembelih, pekurban tidak bisa dibatalkan.');
  }
  await c.query(`update setoran set status='ditolak', alasan='Pekurban batal' where pekurban_id=$1 and status='menunggu'`, [id]);
  const saldo = await saldoTitipan(c, id);
  if (saldo > 0) {
    await postJurnal(c, {
      tanggal,
      keterangan: `Pengembalian dana ${p.nama} (batal)${alasan ? ': ' + alasan : ''}`,
      jenis: 'refund',
      pekurban_id: id,
      baris: [
        { akun: AKUN.TITIPAN, pekurban_id: id, debit: saldo },
        { akun: AKUN.KAS, kredit: saldo },
      ],
    });
  }
  await c.query(`update pekurban set status='batal', hewan_id=null, catatan = trim(catatan || ' ' || $2) where id=$1`, [
    id,
    alasan ? `[Batal: ${alasan}]` : '[Batal]',
  ]);
  await logAksi(c, 'Batalkan pekurban', `${p.nama}, dana dikembalikan ${rp(saldo)}`);
}

// ---------------------------------------------------------------- setoran

export async function tambahSetoran(
  c: Conn,
  d: { pekurban_id: number; tanggal: string; nominal: number; metode: string; catatan?: string; bukti_id?: string | null; sumber: 'pekurban' | 'admin' },
): Promise<number> {
  const p = await getPekurban(c, d.pekurban_id);
  if (p.status !== 'aktif') fail('Pekurban ini sudah tidak aktif, setoran tidak bisa ditambahkan.');
  if (!(d.nominal > 0)) fail('Nominal harus lebih dari 0.');
  if (d.nominal > 1_000_000_000) fail('Nominal terlalu besar.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.tanggal)) fail('Tanggal tidak valid.');
  if (d.tanggal > today()) fail('Tanggal setoran tidak boleh di masa depan.');
  const [r] = await c.query<{ id: number }>(
    `insert into setoran (pekurban_id, tanggal, nominal, metode, catatan, bukti_id, sumber) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [d.pekurban_id, d.tanggal, d.nominal, d.metode, (d.catatan || '').slice(0, 500), d.bukti_id ?? null, d.sumber],
  );
  return r.id;
}

export async function verifikasiSetoran(c: Conn, id: number) {
  const [s] = await c.query('select * from setoran where id = $1', [id]);
  if (!s) fail('Setoran tidak ditemukan.');
  if (s.status !== 'menunggu') fail('Setoran ini sudah diproses.');
  const p = await getPekurban(c, s.pekurban_id);
  if (p.status !== 'aktif') fail('Pekurban sudah tidak aktif.');
  await c.query(`update setoran set status='terverifikasi', diverifikasi=strftime('%Y-%m-%dT%H:%M:%SZ','now') where id=$1`, [id]);
  await postJurnal(c, {
    tanggal: s.tanggal,
    keterangan: `Setoran ${p.nama} terverifikasi (S-${String(id).padStart(4, '0')}, ${s.metode})`,
    jenis: 'setoran',
    pekurban_id: p.id,
    setoran_id: id,
    baris: [
      { akun: AKUN.KAS, debit: Number(s.nominal) },
      { akun: AKUN.TITIPAN, pekurban_id: p.id, kredit: Number(s.nominal) },
    ],
  });
  await logAksi(c, 'Verifikasi setoran', `S-${String(id).padStart(4, '0')} ${p.nama} ${rp(Number(s.nominal))}`);
}

export async function tolakSetoran(c: Conn, id: number, alasan: string) {
  const [s] = await c.query('select s.*, p.nama from setoran s join pekurban p on p.id=s.pekurban_id where s.id = $1', [id]);
  if (!s) fail('Setoran tidak ditemukan.');
  if (s.status !== 'menunggu') fail('Setoran ini sudah diproses.');
  if (!alasan.trim()) fail('Tuliskan alasan penolakan supaya pekurban tahu apa yang harus diperbaiki.');
  await c.query(`update setoran set status='ditolak', alasan=$2, diverifikasi=strftime('%Y-%m-%dT%H:%M:%SZ','now') where id=$1`, [id, alasan.trim()]);
  await logAksi(c, 'Tolak setoran', `S-${String(id).padStart(4, '0')} ${s.nama}: ${alasan}`);
}

export async function batalkanVerifikasi(c: Conn, id: number, alasan: string) {
  const [s] = await c.query('select * from setoran where id = $1', [id]);
  if (!s) fail('Setoran tidak ditemukan.');
  if (s.status !== 'terverifikasi') fail('Hanya setoran terverifikasi yang bisa dibatalkan.');
  if (!alasan.trim()) fail('Tuliskan alasan pembatalan.');
  const p = await getPekurban(c, s.pekurban_id);
  if (p.status !== 'aktif') fail('Pekurban sudah selesai atau batal, setoran tidak bisa dibatalkan.');
  if (p.hewan_id) {
    const h = await getHewan(c, p.hewan_id);
    if (h.status === 'disembelih') fail('Hewan sudah disembelih, setoran tidak bisa dibatalkan.');
  }
  const saldo = await saldoTitipan(c, p.id);
  if (saldo < Number(s.nominal)) fail('Saldo titipan tidak cukup untuk membalik setoran ini.');
  const [j] = await c.query<{ id: number }>(`select id from jurnal where setoran_id=$1 and jenis='setoran' and not dibalik`, [id]);
  if (!j) fail('Jurnal setoran tidak ditemukan.');
  await balikJurnal(c, j.id, today(), alasan.trim(), 'koreksi');
  await c.query(`update setoran set status='ditolak', alasan=$2 where id=$1`, [id, 'Verifikasi dibatalkan: ' + alasan.trim()]);
  await logAksi(c, 'Batalkan verifikasi', `S-${String(id).padStart(4, '0')} ${p.nama}: ${alasan}`);
}

// ---------------------------------------------------------------- hewan

export type HewanInput = { nama: string; jenis: string; kapasitas: number; harga_estimasi: number; catatan: string };

function validHewan(d: HewanInput) {
  if (!d.nama.trim()) fail('Nama hewan wajib diisi, misalnya "Sapi A".');
  if (!['sapi', 'kambing', 'domba'].includes(d.jenis)) fail('Jenis hewan tidak dikenal.');
  if (d.jenis === 'sapi' && (d.kapasitas < 1 || d.kapasitas > 7)) fail('Sapi maksimal 7 pekurban.');
  if (d.jenis !== 'sapi' && d.kapasitas !== 1) fail('Kambing/domba hanya untuk 1 pekurban.');
  if (!(d.harga_estimasi > 0)) fail('Harga estimasi wajib diisi.');
}

export async function tambahHewan(c: Conn, d: HewanInput): Promise<number> {
  validHewan(d);
  const [r] = await c.query<{ id: number }>(
    `insert into hewan (nama, jenis, kapasitas, harga_estimasi, catatan) values ($1,$2,$3,$4,$5) returning id`,
    [d.nama.trim(), d.jenis, d.kapasitas, d.harga_estimasi, d.catatan.trim()],
  );
  await logAksi(c, 'Tambah hewan', `${d.nama} (${d.kapasitas} slot, estimasi ${rp(d.harga_estimasi)})`);
  return r.id;
}

export async function ubahHewan(c: Conn, id: number, d: HewanInput) {
  validHewan(d);
  const h = await getHewan(c, id, true);
  if (h.status === 'disembelih' && (d.kapasitas !== h.kapasitas || d.jenis !== h.jenis)) fail('Hewan sudah disembelih, jenis dan slot tidak bisa diubah.');
  const n = await jumlahPeserta(c, id);
  if (d.kapasitas < n) fail(`Sudah ada ${n} pekurban, slot tidak boleh kurang dari itu.`);
  await c.query(`update hewan set nama=$2, jenis=$3, kapasitas=$4, harga_estimasi=$5, catatan=$6 where id=$1`, [
    id,
    d.nama.trim(),
    d.jenis,
    d.kapasitas,
    d.harga_estimasi,
    d.catatan.trim(),
  ]);
  await logAksi(c, 'Ubah hewan', d.nama);
}

export async function hapusHewan(c: Conn, id: number) {
  const h = await getHewan(c, id, true);
  if (h.status !== 'direncanakan') fail('Hewan yang sudah dibeli tidak bisa dihapus.');
  const n = await jumlahPeserta(c, id);
  if (n > 0) fail('Pindahkan dulu pekurban dari hewan ini.');
  await c.query('update pekurban set hewan_id = null where hewan_id = $1', [id]);
  await c.query('delete from hewan where id = $1', [id]);
  await logAksi(c, 'Hapus hewan', h.nama);
}

export async function beliHewan(c: Conn, id: number, d: { harga: number; tanggal: string; nota_id: string | null }) {
  const h = await getHewan(c, id, true);
  if (h.status !== 'direncanakan') fail('Hewan ini sudah tercatat dibeli.');
  if (!(d.harga > 0)) fail('Harga realisasi wajib diisi.');
  if (!d.nota_id) fail('Unggah foto nota pembelian.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.tanggal) || d.tanggal > today()) fail('Tanggal pembelian tidak valid.');
  await c.query(`update hewan set status='dibeli', harga_realisasi=$2, tgl_beli=$3, nota_id=$4 where id=$1`, [id, d.harga, d.tanggal, d.nota_id]);
  await postJurnal(c, {
    tanggal: d.tanggal,
    keterangan: `Pembelian ${h.nama} (nota terlampir)`,
    jenis: 'beli',
    hewan_id: id,
    baris: [
      { akun: AKUN.PERSEDIAAN, debit: d.harga },
      { akun: AKUN.KAS, kredit: d.harga },
    ],
  });
  await logAksi(c, 'Catat pembelian hewan', `${h.nama} ${rp(d.harga)}`);
}

export async function batalBeli(c: Conn, id: number, alasan: string) {
  const h = await getHewan(c, id, true);
  if (h.status !== 'dibeli') fail('Hanya hewan berstatus "sudah dibeli" yang bisa dibatalkan pembeliannya.');
  if (!alasan.trim()) fail('Tuliskan alasan pembatalan.');
  const [j] = await c.query<{ id: number }>(`select id from jurnal where hewan_id=$1 and jenis='beli' and not dibalik`, [id]);
  if (j) await balikJurnal(c, j.id, today(), alasan.trim(), 'koreksi');
  await c.query(`update hewan set status='direncanakan', harga_realisasi=null, tgl_beli=null where id=$1`, [id]);
  await logAksi(c, 'Batalkan pembelian hewan', `${h.nama}: ${alasan}`);
}

export function bagiPorsi(harga: number, n: number): number[] {
  const dasar = Math.floor(harga / n);
  const sisa = harga - dasar * n;
  return Array.from({ length: n }, (_, i) => dasar + (i < sisa ? 1 : 0));
}

export async function sembelihHewan(c: Conn, id: number, tanggal: string) {
  const h = await getHewan(c, id, true);
  if (h.status !== 'dibeli') fail('Catat pembelian hewan terlebih dahulu.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || tanggal > today()) fail('Tanggal penyembelihan tidak valid.');
  const peserta = await c.query(`select * from pekurban where hewan_id=$1 and status='aktif' order by id`, [id]);
  if (!peserta.length) fail('Belum ada pekurban di hewan ini.');
  const harga = Number(h.harga_realisasi);
  const porsi = bagiPorsi(harga, peserta.length);
  const kurang: string[] = [];
  for (let i = 0; i < peserta.length; i++) {
    const s = await saldoTitipan(c, peserta[i].id);
    if (s < porsi[i]) kurang.push(`${peserta[i].nama} kurang ${rp(porsi[i] - s)}`);
  }
  if (kurang.length) fail('Saldo belum cukup: ' + kurang.join('; ') + '.');
  await postJurnal(c, {
    tanggal,
    keterangan: `${h.nama} disembelih dan dibagi (${peserta.length} pekurban)`,
    jenis: 'sembelih',
    hewan_id: id,
    baris: [
      ...peserta.map((p, i) => ({ akun: AKUN.TITIPAN, pekurban_id: p.id, debit: porsi[i] })),
      { akun: AKUN.PERSEDIAAN, kredit: harga },
    ],
  });
  await c.query(`update hewan set status='disembelih', tgl_sembelih=$2 where id=$1`, [id, tanggal]);
  await logAksi(c, 'Catat penyembelihan', `${h.nama}, ${peserta.length} pekurban, porsi ${rp(porsi[0])}`);
}

export async function selesaikanPekurban(c: Conn, id: number, tipe: string, tanggal: string, catatan = '') {
  const p = await getPekurban(c, id, true);
  if (p.status !== 'aktif') fail(`${p.nama} sudah diselesaikan atau batal.`);
  if (!p.hewan_id) fail(`${p.nama} belum ditempatkan di hewan.`);
  const h = await getHewan(c, p.hewan_id);
  if (h.status !== 'disembelih') fail('Penyelesaian dilakukan setelah hewan disembelih.');
  const [m] = await c.query<{ n: number }>(`select count(*) as n from setoran where pekurban_id=$1 and status='menunggu'`, [id]);
  if (m.n > 0) fail(`${p.nama} masih punya setoran menunggu verifikasi. Proses dulu sebelum diselesaikan.`);
  const sisa = await saldoTitipan(c, id);
  if (sisa < 0) fail('Saldo titipan minus, periksa jurnal.');
  let t = sisa === 0 ? 'lunas' : tipe;
  if (!['lunas', 'refund', 'infak', 'dialihkan'].includes(t)) fail('Pilihan penyelesaian tidak dikenal.');
  if (t === 'lunas' && sisa > 0) t = 'infak';
  let jurnalId: number | null = null;
  if (t === 'refund' || t === 'infak') {
    jurnalId = await postJurnal(c, {
      tanggal,
      keterangan: t === 'refund' ? `Sisa saldo ${p.nama} dikembalikan` : `Sisa saldo ${p.nama} menjadi infak`,
      jenis: t,
      pekurban_id: id,
      hewan_id: h.id,
      baris: [
        { akun: AKUN.TITIPAN, pekurban_id: id, debit: sisa },
        { akun: t === 'refund' ? AKUN.KAS : AKUN.INFAK, kredit: sisa },
      ],
    });
  }
  await c.query(`insert into penyelesaian (pekurban_id, tipe, nominal, tanggal, catatan, jurnal_id) values ($1,$2,$3,$4,$5,$6)`, [
    id,
    t,
    sisa,
    tanggal,
    catatan,
    jurnalId,
  ]);
  await c.query(`update pekurban set status='selesai' where id=$1`, [id]);
  await logAksi(c, 'Penyelesaian pekurban', `${p.nama}: ${t} ${rp(sisa)}`);
}
