import 'server-only';
import { driver, execChunked, lit, sqliteDriver, type Conn } from './db';
import { SCHEMA, TABEL_HAPUS, TABEL_SALIN } from './schema';
import { addDays, rp, tgl, today } from './format';
import { DEFAULT_PENGATURAN } from './settings';
import {
  beliHewan,
  logAksi,
  simpanBuffer,
  tambahHewan,
  tambahPekurban,
  tambahSetoran,
  tolakSetoran,
  verifikasiSetoran,
} from './qurban';

const HAPUS_SQL = [...TABEL_HAPUS.map((t) => `delete from ${t}`), 'delete from sqlite_sequence'];

export async function kosongkan(c: Conn) {
  for (const s of HAPUS_SQL) await c.query(s);
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

function svgBukti(nama: string, nominal: number, tanggal: string, rek: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">
<rect width="420" height="560" fill="#ffffff"/><rect width="420" height="90" fill="#0f6b5a"/>
<text x="24" y="52" font-family="Arial" font-size="22" font-weight="bold" fill="#fff">Transfer Berhasil</text>
<text x="24" y="76" font-family="Arial" font-size="13" fill="#d7efe9">Contoh bukti transfer (data dummy)</text>
<text x="24" y="140" font-family="Arial" font-size="13" fill="#667">Nominal</text>
<text x="24" y="172" font-family="Arial" font-size="30" font-weight="bold" fill="#123">${esc(rp(nominal))}</text>
<text x="24" y="220" font-family="Arial" font-size="13" fill="#667">Tanggal</text>
<text x="24" y="242" font-family="Arial" font-size="17" fill="#123">${esc(tgl(tanggal, true))}</text>
<text x="24" y="284" font-family="Arial" font-size="13" fill="#667">Dari</text>
<text x="24" y="306" font-family="Arial" font-size="17" fill="#123">${esc(nama)}</text>
<text x="24" y="348" font-family="Arial" font-size="13" fill="#667">Ke rekening</text>
<text x="24" y="370" font-family="Arial" font-size="17" fill="#123">${esc(rek)}</text>
<text x="24" y="412" font-family="Arial" font-size="13" fill="#667">Berita</text>
<text x="24" y="434" font-family="Arial" font-size="17" fill="#123">Tabungan qurban</text>
<rect x="24" y="480" width="372" height="1" fill="#dde"/>
<text x="24" y="512" font-family="Arial" font-size="12" fill="#99a">Ref ${Math.random().toString(36).slice(2, 12).toUpperCase()}</text>
</svg>`;
  return Buffer.from(svg);
}

function svgNota(hewan: string, harga: number, tanggal: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="420" viewBox="0 0 480 420">
<rect width="480" height="420" fill="#fffdf6"/><rect x="12" y="12" width="456" height="396" fill="none" stroke="#c9b98f" stroke-width="2"/>
<text x="32" y="58" font-family="Georgia" font-size="24" font-weight="bold" fill="#3a2e12">NOTA PEMBELIAN</text>
<text x="32" y="82" font-family="Arial" font-size="13" fill="#7a6a42">Peternakan Berkah Jaya (contoh, data dummy)</text>
<text x="32" y="130" font-family="Arial" font-size="15" fill="#333">Tanggal: ${esc(tgl(tanggal, true))}</text>
<text x="32" y="170" font-family="Arial" font-size="15" fill="#333">Barang: 1 ekor sapi limousin, ${esc(hewan)}</text>
<text x="32" y="200" font-family="Arial" font-size="15" fill="#333">Berat hidup: kurang lebih 420 kg</text>
<rect x="32" y="232" width="416" height="1" fill="#c9b98f"/>
<text x="32" y="276" font-family="Arial" font-size="15" fill="#333">Total</text>
<text x="448" y="276" text-anchor="end" font-family="Georgia" font-size="26" font-weight="bold" fill="#3a2e12">${esc(rp(harga))}</text>
<text x="32" y="360" font-family="Arial" font-size="13" fill="#7a6a42">Lunas. Terima kasih.</text>
</svg>`;
  return Buffer.from(svg);
}

type SeedPk = { nama: string; hp: string; hewan: string | null; verified: number[]; pending?: number[]; ditolak?: [number, string][]; tunai?: boolean };

async function buatDummy(c: Conn) {
  const T = today();
  const rek = `BSI 7123456789 a.n. Panitia Qurban`;

  const pengaturan = {
    ...DEFAULT_PENGATURAN,
    namaMasjid: 'Masjid Baitul Makmur',
    alamatMasjid: 'Prima Bintara, Bekasi',
    periode: 'Qurban 1448 H / 2027',
    bank: 'Bank Syariah Indonesia',
    noRekening: '7123456789',
    atasNamaRekening: 'Panitia Qurban Masjid Baitul Makmur',
    waPanitia: '081234567890',
    tanggalIdulAdha: '2027-05-16',
    batasPelunasan: '2027-04-30',
    pengumuman: 'Sapi B masih membuka 2 slot. Hubungi panitia untuk mendaftar. Setoran bisa dicicil sampai batas pelunasan.',
    namaBendahara: 'Hasan Basri',
    namaKetua: 'H. Abdul Karim',
    saldoBank: null as number | null,
    tanggalSaldoBank: T,
  };

  const hewan: Record<string, number> = {};
  hewan['Sapi A'] = await tambahHewan(c, { nama: 'Sapi A', jenis: 'sapi', kapasitas: 7, harga_estimasi: 21_000_000, catatan: 'Sapi limousin' });
  hewan['Sapi B'] = await tambahHewan(c, { nama: 'Sapi B', jenis: 'sapi', kapasitas: 7, harga_estimasi: 22_400_000, catatan: 'Sapi bali' });
  hewan['Kambing 1'] = await tambahHewan(c, { nama: 'Kambing 1', jenis: 'kambing', kapasitas: 1, harga_estimasi: 3_500_000, catatan: '' });
  hewan['Kambing 2'] = await tambahHewan(c, { nama: 'Kambing 2', jenis: 'kambing', kapasitas: 1, harga_estimasi: 3_200_000, catatan: '' });

  const data: SeedPk[] = [
    { nama: 'Ahmad Fauzi', hp: '081311110001', hewan: 'Sapi A', verified: [1_000_000, 1_100_000, 1_000_000] },
    { nama: 'Budi Santoso', hp: '081311110002', hewan: 'Sapi A', verified: [3_000_000] },
    { nama: 'Citra Lestari', hp: '081311110003', hewan: 'Sapi A', verified: [1_500_000, 1_500_000] },
    { nama: 'Dedi Kurniawan', hp: '081311110004', hewan: 'Sapi A', verified: [1_000_000, 650_000, 1_300_000] },
    { nama: 'Eko Prasetyo', hp: '081311110005', hewan: 'Sapi A', verified: [800_000, 800_000, 800_000, 600_000], tunai: true },
    { nama: 'Fitri Handayani', hp: '081311110006', hewan: 'Sapi A', verified: [3_000_000] },
    { nama: 'Hj. Siti Aminah', hp: '081311110007', hewan: 'Sapi A', verified: [2_000_000, 1_200_000] },
    { nama: 'Gilang Ramadhan', hp: '081311110008', hewan: 'Sapi B', verified: [1_000_000, 1_000_000], pending: [700_000] },
    { nama: 'Hendra Wijaya', hp: '081311110009', hewan: 'Sapi B', verified: [3_200_000] },
    { nama: 'Indah Permata', hp: '081311110010', hewan: 'Sapi B', verified: [600_000, 600_000], pending: [500_000] },
    { nama: 'Joko Susilo', hp: '081311110011', hewan: 'Sapi B', verified: [1_500_000], ditolak: [[400_000, 'Nominal di bukti tidak sama dengan mutasi rekening. Mohon unggah ulang bukti yang benar.']] },
    { nama: 'Kartika Sari', hp: '081311110012', hewan: 'Sapi B', verified: [800_000] },
    { nama: 'Lukman Hakim', hp: '081311110013', hewan: 'Kambing 1', verified: [1_500_000, 2_000_000] },
    { nama: 'Maya Anggraini', hp: '081311110014', hewan: 'Kambing 2', verified: [1_000_000, 1_000_000], pending: [400_000] },
    { nama: 'Nur Hidayat', hp: '081311110015', hewan: null, verified: [1_000_000] },
  ];

  const kodeContoh: string[] = [];
  for (const [i, d] of data.entries()) {
    const { id, kode } = await tambahPekurban(c, {
      nama: d.nama,
      hp: d.hp,
      alamat: `Perumahan Prima Bintara Blok ${String.fromCharCode(65 + (i % 6))}${(i % 9) + 1}`,
      atas_nama: d.nama.replace(/^Hj\. /, ''),
      hewan_id: d.hewan ? hewan[d.hewan] : null,
      catatan: '',
    });
    if (i < 3 || d.pending) kodeContoh.push(`${d.nama}: ${kode}`);
    const n = d.verified.length;
    for (const [j, nominal] of d.verified.entries()) {
      const tanggal = addDays(T, -(150 - j * Math.floor(120 / Math.max(1, n - 1))) - i);
      const tunai = !!d.tunai;
      const bukti = tunai ? null : await simpanBuffer(c, svgBukti(d.nama, nominal, tanggal, rek), 'image/svg+xml', 'bukti-dummy.svg');
      const sid = await tambahSetoran(c, {
        pekurban_id: id,
        tanggal,
        nominal,
        metode: tunai ? 'tunai' : 'transfer',
        bukti_id: bukti,
        sumber: tunai ? 'admin' : 'pekurban',
        catatan: tunai ? 'Setor tunai ke bendahara setelah kajian' : '',
      });
      await verifikasiSetoran(c, sid);
    }
    for (const [nominal, alasan] of d.ditolak || []) {
      const tanggal = addDays(T, -20);
      const bukti = await simpanBuffer(c, svgBukti(d.nama, nominal - 50_000, tanggal, rek), 'image/svg+xml', 'bukti-dummy.svg');
      const sid = await tambahSetoran(c, { pekurban_id: id, tanggal, nominal, metode: 'transfer', bukti_id: bukti, sumber: 'pekurban' });
      await tolakSetoran(c, sid, alasan);
    }
    for (const [j, nominal] of (d.pending || []).entries()) {
      const tanggal = addDays(T, -1 - j - (i % 3));
      const bukti = await simpanBuffer(c, svgBukti(d.nama, nominal, tanggal, rek), 'image/svg+xml', 'bukti-dummy.svg');
      await tambahSetoran(c, { pekurban_id: id, tanggal, nominal, metode: 'transfer', bukti_id: bukti, sumber: 'pekurban', catatan: 'Cicilan bulan ini' });
    }
  }

  // Sapi A sudah dibeli (belum disembelih), supaya alur penyembelihan dan penyelesaian bisa dicoba.
  const tBeli = addDays(T, -4);
  const nota = await simpanBuffer(c, svgNota('Sapi A', 20_650_000, tBeli), 'image/svg+xml', 'nota-dummy.svg');
  await beliHewan(c, hewan['Sapi A'], { harga: 20_650_000, tanggal: tBeli, nota_id: nota });

  // Saldo bank menurut mutasi = kas sistem + setoran yang belum diverifikasi (sudah masuk rekening).
  const [k] = await c.query<{ s: number }>(`select coalesce(sum(debit - kredit),0) as s from jurnal_baris where akun = '1-1100'`);
  const [m] = await c.query<{ s: number }>(`select coalesce(sum(nominal),0) as s from setoran where status = 'menunggu'`);
  pengaturan.saldoBank = Number(k.s) + Number(m.s);
  await c.query(`insert into pengaturan (id, data) values (1, $1) on conflict (id) do update set data = excluded.data`, [
    JSON.stringify(pengaturan),
  ]);
  await logAksi(c, 'Isi data dummy', `15 pekurban, 4 hewan. Contoh kode: ${kodeContoh.slice(0, 3).join(', ')}`);
}

/**
 * Data dummy dibangun dulu di SQLite memori (memakai logika yang sama dengan aplikasi),
 * lalu disalin ke database utama dalam beberapa request saja. Jauh lebih cepat untuk D1 via HTTP.
 */
export async function isiDataDummy() {
  const staging = await sqliteDriver(':memory:');
  await staging.exec(SCHEMA);
  await staging.tx((c) => buatDummy(c));

  const stmts: string[] = [...HAPUS_SQL];
  const [peng] = await staging.query<{ data: string }>('select data from pengaturan where id = 1');
  stmts.push(`insert into pengaturan (id, data) values (1, ${lit(peng.data)}) on conflict (id) do update set data = excluded.data`);
  for (const t of TABEL_SALIN) {
    const rows = await staging.query(`select * from ${t} order by rowid`);
    for (const r of rows) {
      const cols = Object.keys(r);
      stmts.push(`insert into ${t} (${cols.join(', ')}) values (${cols.map((k) => lit(r[k])).join(', ')})`);
    }
  }
  await execChunked(await driver(), stmts);
}
